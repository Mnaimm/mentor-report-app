import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function UsahawanSaya() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entrepreneurs, setEntrepreneurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchEntrepreneurs();
    }
  }, [session]);

  const fetchEntrepreneurs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/getMentorEntrepreneurs');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch entrepreneurs');
      }

      setEntrepreneurs(result.data || []);
    } catch (err) {
      console.error('Error fetching entrepreneurs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function: get initials from name
  const getInitials = (name) => {
    if (!name) return '??';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  // Helper function: convert to title case
  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function: get program display name
  const getProgramName = (programType) => {
    if (!programType) return 'Unknown';
    if (programType.toLowerCase().includes('bangkit')) return 'Bangkit';
    if (programType.toLowerCase().includes('maju')) return 'Maju';
    return programType;
  };

  // Filter entrepreneurs based on search and active filter
  const filteredEntrepreneurs = entrepreneurs.filter(e => {
    // Filter by program
    const programName = getProgramName(e.program_type);
    if (activeFilter !== 'Semua' && programName !== activeFilter) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = (e.mentee_name || '').toLowerCase().includes(query);
      const businessMatch = (e.business_name || '').toLowerCase().includes(query);
      const locationMatch = (e.zone || e.state || '').toLowerCase().includes(query);
      return nameMatch || businessMatch || locationMatch;
    }

    return true;
  });

  // Count by program
  const bangkitCount = entrepreneurs.filter(e => getProgramName(e.program_type) === 'Bangkit').length;
  const majuCount = entrepreneurs.filter(e => getProgramName(e.program_type) === 'Maju').length;

  // Toggle row expansion
  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  // Handle action button clicks (prevent row expansion)
  const handleAction = (e, action, data) => {
    e.stopPropagation();
    if (action === 'call') {
      window.location.href = `tel:${data}`;
    } else if (action === 'email') {
      window.location.href = `mailto:${data}`;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuatkan...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Usahawan Saya - iTEKAD Mentor Portal</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xl">
                    👥
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Usahawan Saya</h1>
                </div>
                <p className="text-sm text-gray-600 ml-[52px]">Direktori usahawan yang ditugaskan kepada anda</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                ← Kembali
              </button>
            </div>

            {/* Stat Pills */}
            <div className="flex gap-3 mt-6">
              <div className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                Jumlah: <span className="font-bold">{entrepreneurs.length}</span>
              </div>
              <div className="px-4 py-2 bg-blue-50 rounded-full text-sm font-medium text-blue-700 border border-blue-200">
                Bangkit: <span className="font-bold">{bangkitCount}</span>
              </div>
              <div className="px-4 py-2 bg-orange-50 rounded-full text-sm font-medium text-orange-700 border border-orange-200">
                Maju: <span className="font-bold">{majuCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Toolbar */}
          <div className="bg-white rounded-t-2xl border border-gray-200 border-b-0 px-6 py-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Cari nama, perniagaan, atau lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                {['Semua', 'Bangkit', 'Maju'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeFilter === filter
                        ? filter === 'Bangkit'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : filter === 'Maju'
                          ? 'bg-orange-100 text-orange-700 border border-orange-300'
                          : 'bg-gray-200 text-gray-800 border border-gray-300'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Hint */}
            <p className="text-xs text-gray-500 mt-3">
              💡 Klik pada mana-mana baris untuk lihat alamat penuh
            </p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
            {error && (
              <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                <p className="text-sm text-red-700">❌ {error}</p>
              </div>
            )}

            {!loading && filteredEntrepreneurs.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500">Tiada usahawan dijumpai</p>
              </div>
            )}

            {!loading && filteredEntrepreneurs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-gray-200">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Usahawan</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Perniagaan</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lokasi</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Program</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Hubungi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntrepreneurs.map((entrepreneur, index) => {
                      const isExpanded = expandedRow === index;
                      const programName = getProgramName(entrepreneur.program_type);
                      const isUrgent = programName === 'Bangkit';

                      return (
                        <React.Fragment key={entrepreneur.id || index}>
                          {/* Main Row */}
                          <tr
                            onClick={() => toggleRow(index)}
                            className={`border-b border-[#F1F5F9] cursor-pointer transition-colors ${
                              isExpanded ? 'bg-[#EFF6FF]' : 'hover:bg-[#FAFBFF]'
                            }`}
                          >
                            {/* Usahawan */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                    programName === 'Bangkit' ? 'bg-blue-500' : 'bg-orange-500'
                                  }`}
                                >
                                  {getInitials(entrepreneur.mentee_name)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {toTitleCase(entrepreneur.mentee_name)}
                                  </span>
                                  <svg
                                    className={`w-4 h-4 transition-transform ${
                                      isExpanded ? 'rotate-180 text-blue-600' : 'text-gray-400'
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </td>

                            {/* Perniagaan */}
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {entrepreneur.business_name || '-'}
                            </td>

                            {/* Lokasi */}
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {entrepreneur.zone || entrepreneur.state || '-'}
                            </td>

                            {/* Program */}
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                                  programName === 'Bangkit'
                                    ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                                    : 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    programName === 'Bangkit' ? 'bg-[#3B82F6]' : 'bg-[#F97316]'
                                  }`}
                                />
                                {programName}
                              </span>
                            </td>

                            {/* Hubungi */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {entrepreneur.phone && (
                                  <button
                                    onClick={(e) => handleAction(e, 'call', entrepreneur.phone)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Telefon"
                                  >
                                    📞
                                  </button>
                                )}
                                {entrepreneur.email && (
                                  <button
                                    onClick={(e) => handleAction(e, 'email', entrepreneur.email)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="E-mel"
                                  >
                                    ✉️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Address Row */}
                          {isExpanded && (
                            <tr className="bg-[#EFF6FF] border-b border-[#BFDBFE]">
                              <td colSpan="5" className="px-6 py-0">
                                <div
                                  className="overflow-hidden transition-all duration-300"
                                  style={{
                                    maxHeight: isExpanded ? '120px' : '0px'
                                  }}
                                >
                                  <div className="py-4">
                                    <div className="flex items-start gap-3 bg-white rounded-lg p-4 border border-blue-200">
                                      <span className="text-2xl">🏠</span>
                                      <div className="flex-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                          Alamat Premis
                                        </p>
                                        <p className="text-sm text-gray-700 mb-2">
                                          {entrepreneur.address || 'Alamat tidak tersedia'}
                                        </p>
                                        {entrepreneur.address && (
                                          <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entrepreneur.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                          >
                                            🗺 Buka di Google Maps →
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F8FAFC] border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Menunjukkan <span className="font-semibold">{filteredEntrepreneurs.length}</span> daripada{' '}
                <span className="font-semibold">{entrepreneurs.length}</span> usahawan
              </p>
              <p className="text-sm text-gray-500">iTEKAD Mentor Portal</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
