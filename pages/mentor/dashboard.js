// pages/mentor/dashboard.js
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import MenteeCard from '../../components/MenteeCard';

export default function MentorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    batch: 'all',
    program: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('progress'); // Default: show incomplete first

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mentor/my-dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAndSortedMentees = () => {
    if (!dashboardData?.mentees) return [];

    let filtered = dashboardData.mentees;

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(m => m.status === filters.status);
    }

    // Apply batch filter
    if (filters.batch !== 'all') {
      filtered = filtered.filter(m => m.batch === filters.batch);
    }

    // Apply program filter
    if (filters.program !== 'all') {
      filtered = filtered.filter(m => m.program === filters.program);
    }

    // Apply search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchLower) ||
        m.businessName.toLowerCase().includes(searchLower) ||
        m.email.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          // Sort by status first (on_track last, others by urgency), then by due date
          const statusOrder = {
            'overdue': 1,
            'due_soon': 2,
            'pending': 3,
            'mia': 4,
            'pending_first_session': 5,
            'on_track': 6  // Completed goes to bottom
          };
          
          const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          if (statusDiff !== 0) return statusDiff;
          
          // Within same status, sort by due date
          if (!a.daysUntilDue) return 1;
          if (!b.daysUntilDue) return -1;
          return a.daysUntilDue - b.daysUntilDue;
          
        case 'name':
          return a.name.localeCompare(b.name);
          
        case 'progress':
          const aProgress = a.expectedReportsThisRound > 0 
            ? (a.reportsThisRound / a.expectedReportsThisRound) 
            : 0;
          const bProgress = b.expectedReportsThisRound > 0 
            ? (b.reportsThisRound / b.expectedReportsThisRound) 
            : 0;
          return aProgress - bProgress; // Ascending: 0/1 first, 1/1 last
          
        case 'batch':
          // Sort by batch name (handle null/undefined)
          const aBatch = a.batch || '';
          const bBatch = b.batch || '';
          return aBatch.localeCompare(bBatch);
          
        default:
          return 0;
      }
    });

    return sorted;
  };

  const handleSubmitReport = (mentee) => {
    // Determine which form based on program
    const isBangkit = mentee.program?.toLowerCase().includes('bangkit');
    const formUrl = isBangkit ? '/laporan-sesi' : '/laporan-maju';
    
    // Navigate to form with mentee ID as query param
    router.push(`${formUrl}?mentee=${mentee.id}&name=${encodeURIComponent(mentee.name)}`);
  };

  const handleViewDetails = (mentee) => {
    // For now, show an alert with mentee info (can be replaced with modal or detail page)
    alert(`Mentee Details:\n\nName: ${mentee.name}\nBusiness: ${mentee.businessName}\nProgram: ${mentee.program}\nBatch: ${mentee.batch}\nEmail: ${mentee.email}\nPhone: ${mentee.phone || 'N/A'}\n\nCurrent Round: ${mentee.currentRound}\nProgress: ${mentee.reportsThisRound}/${mentee.expectedReportsThisRound}\nStatus: ${mentee.status}`);
    
    // Future: Navigate to dedicated detail page
    // router.push(`/mentor/mentee/${mentee.id}`);
  };

  const handleContact = (mentee, method) => {
    if (method === 'email') {
      window.location.href = `mailto:${mentee.email}`;
    } else if (method === 'phone' && mentee.phone) {
      window.location.href = `tel:${mentee.phone}`;
    }
  };

  // Get unique values for filters
  const uniqueBatches = dashboardData?.mentees 
    ? [...new Set(dashboardData.mentees.map(m => m.batch))].sort()
    : [];
  
  const uniquePrograms = dashboardData?.mentees
    ? [...new Set(dashboardData.mentees.map(m => m.program))].sort()
    : [];

  const filteredMentees = getFilteredAndSortedMentees();

  if (loading) {
    return (
      <Layout title="My Mentees">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="My Mentees">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-semibold mb-2">Error Loading Dashboard</p>
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Mentees">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Mentees Dashboard</h1>
          <p className="text-gray-600 mb-3">
            Welcome back, {session?.user?.name || 'Mentor'}! Track your mentees' progress and upcoming sessions.
          </p>
          
          {/* Quick Insights */}
          {dashboardData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Quick Insights:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium text-green-600">{dashboardData.stats?.onTrack || 0}</span> mentees on track
                    </div>
                    <div>
                      <span className="font-medium text-yellow-600">{dashboardData.stats?.dueSoon || 0}</span> due soon
                    </div>
                    <div>
                      <span className="font-medium text-red-600">{dashboardData.stats?.overdue || 0}</span> overdue
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Mentees</p>
                <p className="text-3xl font-bold text-gray-900">{dashboardData?.stats?.totalMentees || 0}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On Track</p>
                <p className="text-3xl font-bold text-green-600">{dashboardData?.stats?.onTrack || 0}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Due Soon</p>
                <p className="text-3xl font-bold text-yellow-600">{dashboardData?.stats?.dueSoon || 0}</p>
              </div>
              <div className="text-4xl">⏰</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{dashboardData?.stats?.overdue || 0}</p>
              </div>
              <div className="text-4xl">🔴</div>
            </div>
          </div>
        </div>

        {/* Timeline Widget */}
        {filteredMentees.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              📅 Upcoming Due Dates
            </h3>
            <div className="space-y-4">
              {(() => {
                const today = new Date();
                const thisWeekEnd = new Date(today);
                thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
                const nextWeekEnd = new Date(today);
                nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);

                const thisWeek = filteredMentees.filter(m => {
                  if (!m.roundDueDate || m.status === 'on_track') return false;
                  const dueDate = new Date(m.roundDueDate);
                  return dueDate >= today && dueDate <= thisWeekEnd;
                });

                const nextWeek = filteredMentees.filter(m => {
                  if (!m.roundDueDate || m.status === 'on_track') return false;
                  const dueDate = new Date(m.roundDueDate);
                  return dueDate > thisWeekEnd && dueDate <= nextWeekEnd;
                });

                const later = filteredMentees.filter(m => {
                  if (!m.roundDueDate || m.status === 'on_track') return false;
                  const dueDate = new Date(m.roundDueDate);
                  return dueDate > nextWeekEnd;
                });

                const overdue = filteredMentees.filter(m => m.status === 'overdue');

                return (
                  <>
                    {overdue.length > 0 && (
                      <div className="border-l-4 border-red-500 pl-4">
                        <p className="text-sm font-semibold text-red-600 mb-1">⚠️ Overdue ({overdue.length})</p>
                        <p className="text-sm text-gray-600">
                          {overdue.slice(0, 3).map(m => m.name).join(', ')}
                          {overdue.length > 3 && ` +${overdue.length - 3} more`}
                        </p>
                      </div>
                    )}
                    
                    {thisWeek.length > 0 && (
                      <div className="border-l-4 border-yellow-500 pl-4">
                        <p className="text-sm font-semibold text-yellow-600 mb-1">This Week ({thisWeek.length})</p>
                        <p className="text-sm text-gray-600">
                          {thisWeek.slice(0, 3).map(m => m.name).join(', ')}
                          {thisWeek.length > 3 && ` +${thisWeek.length - 3} more`}
                        </p>
                      </div>
                    )}
                    
                    {nextWeek.length > 0 && (
                      <div className="border-l-4 border-blue-500 pl-4">
                        <p className="text-sm font-semibold text-blue-600 mb-1">Next Week ({nextWeek.length})</p>
                        <p className="text-sm text-gray-600">
                          {nextWeek.slice(0, 3).map(m => m.name).join(', ')}
                          {nextWeek.length > 3 && ` +${nextWeek.length - 3} more`}
                        </p>
                      </div>
                    )}
                    
                    {later.length > 0 && (
                      <div className="border-l-4 border-gray-400 pl-4">
                        <p className="text-sm font-semibold text-gray-600 mb-1">Later ({later.length})</p>
                        <p className="text-sm text-gray-600">
                          {later.slice(0, 3).map(m => m.name).join(', ')}
                          {later.length > 3 && ` +${later.length - 3} more`}
                        </p>
                      </div>
                    )}

                    {overdue.length === 0 && thisWeek.length === 0 && nextWeek.length === 0 && later.length === 0 && (
                      <p className="text-sm text-gray-500 italic">🎉 All mentees are on track!</p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search by name, business, or email..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="on_track">On Track</option>
                <option value="due_soon">Due Soon</option>
                <option value="overdue">Overdue</option>
                <option value="mia">MIA</option>
                <option value="pending_first_session">Pending First Session</option>
              </select>
            </div>

            {/* Batch Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select
                value={filters.batch}
                onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Batches</option>
                {uniqueBatches.map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>

            {/* Program Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
              <select
                value={filters.program}
                onChange={(e) => setFilters({ ...filters, program: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Programs</option>
                {uniquePrograms.map(program => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Options */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
              <button
                onClick={() => setSortBy('progress')}
                className={`px-3 py-1 text-sm rounded ${
                  sortBy === 'progress' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Progress
              </button>
              <button
                onClick={() => setSortBy('batch')}
                className={`px-3 py-1 text-sm rounded ${
                  sortBy === 'batch' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Batch
              </button>
              <button
                onClick={() => setSortBy('dueDate')}
                className={`px-3 py-1 text-sm rounded ${
                  sortBy === 'dueDate' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Due Date
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-3 py-1 text-sm rounded ${
                  sortBy === 'name' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Name
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Showing {filteredMentees.length} of {dashboardData?.mentees?.length || 0} mentees
            </p>
          </div>
        </div>

        {/* Mentees Grid */}
        {filteredMentees.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl font-semibold text-gray-700 mb-2">No mentees found</p>
            <p className="text-gray-500">
              {filters.status !== 'all' || filters.batch !== 'all' || filters.program !== 'all' || filters.search
                ? 'Try adjusting your filters'
                : 'You have no mentees assigned yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMentees.map(mentee => (
              <MenteeCard
                key={mentee.id}
                mentee={mentee}
                onSubmitReport={handleSubmitReport}
                onViewDetails={handleViewDetails}
                onContact={handleContact}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
