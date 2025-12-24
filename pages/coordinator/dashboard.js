// pages/coordinator/dashboard.js
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';

export default function CoordinatorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState(null);

  // New: Dashboard summary from views
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [unassignedMentees, setUnassignedMentees] = useState([]);
  const unassignedTableRef = useRef(null);

  // Filters
  const [mentorStatusFilter, setMentorStatusFilter] = useState('all');
  const [mentorProgramFilter, setMentorProgramFilter] = useState('all');
  const [mentorRegionFilter, setMentorRegionFilter] = useState('all');
  const [mentorBatchFilter, setMentorBatchFilter] = useState('all');
  const [menteeStatusFilter, setMenteeStatusFilter] = useState('all');
  const [menteeRegionFilter, setMenteeRegionFilter] = useState('all');
  const [menteeProgramFilter, setMenteeProgramFilter] = useState('all');
  const [menteeBatchFilter, setMenteeBatchFilter] = useState('all');
  const [menteeSearchQuery, setMenteeSearchQuery] = useState('');

  // Bulk assignment state
  const [selectedMentees, setSelectedMentees] = useState(new Set());
  const [bulkAssignMentor, setBulkAssignMentor] = useState('');

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin');
    } else if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status, router]);

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch dashboard summary from views (8 cards)
      const summaryRes = await fetch('/api/coordinator/dashboard-summary');
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setDashboardSummary(summaryData.summary);
        setUnassignedMentees(summaryData.unassigned || []);
      }

      // Fetch stats (legacy)
      const statsRes = await fetch('/api/dashboard/stats');
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      // Fetch mentors
      const mentorsRes = await fetch('/api/coordinator/mentors');
      if (mentorsRes.ok) {
        const data = await mentorsRes.json();
        setMentors(data.mentors || []);
      } else {
        const errorData = await mentorsRes.json();
        console.error('Mentors API error:', errorData);
      }

      // Fetch mentees
      const menteesRes = await fetch('/api/coordinator/mentees');
      if (menteesRes.ok) {
        const data = await menteesRes.json();
        setMentees(data.mentees || []);
      } else {
        const errorData = await menteesRes.json();
        console.error('Mentees API error:', errorData);
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  function handleViewProfile(mentor) {
    alert(`Mentor Profile:\n\nName: ${mentor.name}\nEmail: ${mentor.email}\nPhone: ${mentor.phone || 'N/A'}\nStatus: ${mentor.status}\nPremier: ${mentor.isPremier ? 'Yes' : 'No'}\nPrograms: ${mentor.programs.join(', ')}\nRegions: ${mentor.regions.join(', ')}\n\nCapacity: ${mentor.assignedMentees}/${mentor.maxMentees} mentees\nAvailable Slots: ${mentor.availableSlots}\n\nPerformance:\n- Reports: ${mentor.reportsSubmitted}/${mentor.totalSessions} (${mentor.reportCompletionRate}%)\n- Avg Response: ${mentor.avgResponseTime} days\n\nBio: ${mentor.bio || 'No bio available'}`);
  }

  function handleContactMentor(mentor) {
    const subject = encodeURIComponent(`iTEKAD Mentor Portal - Contact from Program Coordinator`);
    const body = encodeURIComponent(`Dear ${mentor.name},\n\n[Your message here]\n\nBest regards,\n${session?.user?.name || 'Program Coordinator'}`);
    window.location.href = `mailto:${mentor.email}?subject=${subject}&body=${body}`;
  }

  async function handleAssignMentor() {
    if (!selectedMentee || !selectedMentor) {
      alert('Please select both a mentee and a mentor');
      return;
    }

    setAssigning(true);
    try {
      console.log('Assigning mentor:', { menteeId: selectedMentee.id, mentorId: selectedMentor });
      
      const res = await fetch('/api/coordinator/assign-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menteeId: selectedMentee.id,
          mentorId: selectedMentor,
          notes: assignmentNotes,
          reason: 'New assignment'
        })
      });

      const data = await res.json();
      console.log('Assignment response:', data);

      if (res.ok) {
        alert(`✅ Assignment logged in activity log!\n\n⚠️ IMPORTANT: To make this assignment permanent, you must manually update the Google Sheets 'mapping' tab:\n1. Open the mapping sheet\n2. Find row for: ${selectedMentee.name}\n3. Update 'Mentor_Email' column to: ${data.assignment.mentorEmail}\n\nThe dashboard reads from Google Sheets, so changes won't persist until the sheet is updated.`);
        setShowAssignModal(false);
        setSelectedMentee(null);
        setSelectedMentor('');
        setAssignmentNotes('');
        // Don't refresh - it will still show old data from sheets
      } else {
        console.error('Assignment failed:', data);
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Assignment error:', err);
      alert('Failed to assign mentor: ' + err.message);
    } finally {
      setAssigning(false);
    }
  }

  // Bulk assignment handlers
  const handleSelectMentee = (menteeId) => {
    const newSelected = new Set(selectedMentees);
    if (newSelected.has(menteeId)) {
      newSelected.delete(menteeId);
    } else {
      newSelected.add(menteeId);
    }
    setSelectedMentees(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMentees.size === filteredMentees.length) {
      setSelectedMentees(new Set());
    } else {
      setSelectedMentees(new Set(filteredMentees.map(m => m.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignMentor) {
      alert('❌ Please select a mentor');
      return;
    }

    if (selectedMentees.size === 0) {
      alert('❌ Please select at least one mentee');
      return;
    }

    // Find mentor and check capacity
    const mentor = mentors.find(m => m.id === bulkAssignMentor);
    if (!mentor) {
      alert('❌ Mentor not found');
      return;
    }

    if (selectedMentees.size > mentor.availableSlots) {
      alert(`❌ Mentor only has ${mentor.availableSlots} available slots, but you selected ${selectedMentees.size} mentees`);
      return;
    }

    const confirmed = confirm(`Assign ${selectedMentees.size} mentees to ${mentor.name}?`);
    if (!confirmed) return;

    setAssigning(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const menteeId of selectedMentees) {
        const mentee = filteredMentees.find(m => m.id === menteeId);
        if (!mentee) continue;

        try {
          const response = await fetch('/api/coordinator/assign-mentor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menteeId: mentee.id,
              mentorId: bulkAssignMentor,
              notes: 'Bulk assignment',
              reason: 'Bulk assignment'
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error('Failed to assign:', mentee.name, err);
        }
      }

      alert(`✅ Bulk assignment complete!\n\nSuccess: ${successCount}\nFailed: ${failCount}`);
      setSelectedMentees(new Set());
      setBulkAssignMentor('');
      fetchDashboardData(); // Refresh data

    } catch (err) {
      console.error('Bulk assignment error:', err);
      alert('Failed to complete bulk assignment: ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  // CSV Export handler
  const handleExportCSV = () => {
    // Create CSV header
    const header = 'Name,Business,Mentor,Batch,Region,Status,Sessions Completed,Total Sessions,Progress %,Last Report Date,Days Since Report\n';
    
    // Create CSV rows from filtered mentees
    const rows = filteredMentees.map(mentee => {
      return [
        mentee.name || '',
        mentee.businessName || '',
        mentee.mentorName || '',
        mentee.batch || '',
        mentee.region || '',
        mentee.status || '',
        mentee.sessionsCompleted || 0,
        mentee.totalSessions || 0,
        mentee.progressPercentage || 0,
        mentee.lastReportDate || 'N/A',
        mentee.daysSinceLastReport || 'N/A'
      ].map(field => `"${field}"`).join(',');
    }).join('\n');
    
    const csv = header + rows;
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `mentees_export_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter mentors
  const filteredMentors = mentors.filter(mentor => {
    if (mentorStatusFilter === 'active' && mentor.reportCompletionRate < 80) return false;
    if (mentorStatusFilter === 'behind' && mentor.reportCompletionRate >= 80) return false;
    if (mentorProgramFilter !== 'all' && !mentor.programs?.includes(mentorProgramFilter)) return false;
    if (mentorRegionFilter !== 'all' && !mentor.regions?.includes(mentorRegionFilter)) return false;
    
    // Batch filter - check if mentor has mentees in selected batch
    if (mentorBatchFilter !== 'all') {
      const mentorMentees = mentees.filter(m => m.mentorName === mentor.name);
      const hasBatchMentee = mentorMentees.some(m => m.batch === mentorBatchFilter);
      if (!hasBatchMentee) return false;
    }
    
    return true;
  });

  // Filter mentees
  const filteredMentees = mentees.filter((mentee) => {
    // Status filter
    if (menteeStatusFilter !== 'all' && mentee.status !== menteeStatusFilter) return false;
    
    // Region filter
    if (menteeRegionFilter !== 'all' && mentee.region !== menteeRegionFilter) return false;
    
    // Program filter
    if (menteeProgramFilter !== 'all' && !mentee.batch?.toLowerCase().includes(menteeProgramFilter.toLowerCase())) return false;
    
    // Batch filter
    if (menteeBatchFilter !== 'all' && mentee.batch !== menteeBatchFilter) return false;

    // Search filter
    if (menteeSearchQuery.trim()) {
      const query = menteeSearchQuery.toLowerCase();
      return (
        mentee.name?.toLowerCase().includes(query) ||
        mentee.businessName?.toLowerCase().includes(query) ||
        mentee.mentorName?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Get unique values for filters
  const regions = [...new Set(mentees.map(m => m.region))].sort();
  const programs = [...new Set(mentees.map(m => m.batch?.split(' ').pop()).filter(Boolean))].sort();
  const batches = [...new Set(mentees.map(m => m.batch).filter(Boolean))].sort();
  const mentorPrograms = [...new Set(mentors.flatMap(m => m.programs || []))].sort();
  const mentorRegions = [...new Set(mentors.flatMap(m => m.regions || []))].sort();
  
  // Get unique batches from all mentees for mentor filtering
  const mentorBatches = [...new Set(mentees.map(m => m.batch).filter(Boolean))].sort();

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Program Coordinator Dashboard</h1>
          <p className="text-gray-600 mt-1">
            {stats?.myProgram || 'Program'} - Manage mentors and mentees
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Top Statistics Cards - 8 Cards */}
        {dashboardSummary && (
          <>
            {/* Banner explaining 30-day grace period */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                📌 <strong>Status Rules:</strong> Reports allowed until 30 days after session date. 
                Mentors are marked <span className="font-semibold">Critical</span> only after grace expires.
              </p>
            </div>

            {/* Row 1: 4 cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard
                title="Total Mentees"
                value={dashboardSummary.total_mentees || 0}
                subtitle="All mentees in program"
                icon="👥"
                loading={loading}
              />
              <KpiCard
                title="Active Mentors"
                value={dashboardSummary.active_mentors || 0}
                subtitle="Assigned mentors"
                icon="👨‍🏫"
                loading={loading}
              />
              <KpiCard
                title="Overall Completion"
                value={`${dashboardSummary.overall_completion_pct || 0}%`}
                subtitle="Reports submitted/expected"
                icon="📊"
                loading={loading}
              />
              <KpiCard
                title="Reports This Month"
                value={dashboardSummary.reports_this_month || 0}
                subtitle="Current month"
                icon="📝"
                loading={loading}
              />
            </div>

            {/* Row 2: 4 cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiCard
                title="Unassigned Mentees"
                value={dashboardSummary.unassigned_mentees || 0}
                subtitle="Click to view table below"
                icon="⚠️"
                color={dashboardSummary.unassigned_mentees > 0 ? 'bg-yellow-50' : 'bg-white'}
                onClick={() => unassignedTableRef.current?.scrollIntoView({ behavior: 'smooth' })}
                loading={loading}
              />
              <KpiCard
                title="Pending (within 30d)"
                value={dashboardSummary.pending_mentors || 0}
                subtitle="Reports due soon"
                icon="⏳"
                color="bg-blue-50"
                loading={loading}
              />
              <KpiCard
                title="Critical Mentors"
                value={dashboardSummary.critical_mentors || 0}
                subtitle="Overdue after grace"
                icon="🚨"
                color={dashboardSummary.critical_mentors > 0 ? 'bg-red-50' : 'bg-white'}
                loading={loading}
              />
              <KpiCard
                title="Sessions Due This Week"
                value={dashboardSummary.sessions_due_this_week || 0}
                subtitle="Next 7 days"
                icon="📅"
                loading={loading}
              />
            </div>
          </>
        )}

        {/* Legacy stats cards (fallback) */}
        {!dashboardSummary && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="My Program"
              value={stats?.myProgram || 'N/A'}
            />
            <StatCard
              title="Active Mentors"
              value={stats?.activeMentors || 0}
              subtitle={stats?.inactiveMentors ? `${stats.inactiveMentors} inactive` : ''}
            />
            <StatCard
              title="Total Mentees"
              value={stats?.totalMentees || 0}
              subtitle={stats?.pendingMentees ? `${stats.pendingMentees} pending` : ''}
            />
            <StatCard
              title="Reports This Month"
              value={stats?.reportsThisMonth || 0}
              change={stats?.reportsChange ? `+${stats.reportsChange} vs last` : null}
              changeType="increase"
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchDashboardData}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              🔄 Refresh Data
            </button>
            <div className="text-sm text-gray-600 flex items-center">
              💡 Tip: Click "Assign" or "Reassign" on mentee cards to assign mentors
            </div>
          </div>
        </div>

        {/* Mentor Performance Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-lg font-semibold">Mentor Performance</h3>
                <p className="text-xs text-gray-500 mt-1">
                  📊 Metrics: Reports Submitted, Completion Rate, Response Time (days to respond) • 
                  Status: ✅ Active (≥80%), ⚠️ Behind (60-79%), 🔴 Critical (&lt;60%)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={mentorStatusFilter}
                onChange={(e) => setMentorStatusFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active (≥80%)</option>
                <option value="behind">Behind (&lt;80%)</option>
              </select>
              <select
                value={mentorProgramFilter}
                onChange={(e) => setMentorProgramFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All Programs</option>
                {mentorPrograms.map(program => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
              <select
                value={mentorBatchFilter}
                onChange={(e) => setMentorBatchFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All Batches</option>
                {mentorBatches.map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
              <select
                value={mentorRegionFilter}
                onChange={(e) => setMentorRegionFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All Regions</option>
                {mentorRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentor Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reports</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMentors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      No mentors found
                    </td>
                  </tr>
                ) : (
                  filteredMentors.map((mentor) => (
                    <tr key={mentor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{mentor.name}</div>
                        <div className="text-xs text-gray-500">{mentor.email}</div>
                        {mentor.isPremier && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                            Premier
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mentor.assignedMentees} / {mentor.maxMentees}
                        <div className="text-xs text-gray-500">{mentor.availableSlots} slots available</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mentor.reportsSubmitted} / {mentor.totalSessions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            mentor.reportCompletionRate >= 80 ? 'text-green-600' :
                            mentor.reportCompletionRate >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {mentor.reportCompletionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mentor.avgResponseTime} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          mentor.reportCompletionRate >= 80 
                            ? 'bg-green-100 text-green-800'
                            : mentor.reportCompletionRate >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {mentor.reportCompletionRate >= 80 ? '✅ Active' : 
                           mentor.reportCompletionRate >= 60 ? '⚠️ Behind' : '🔴 Critical'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => handleViewProfile(mentor)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={() => handleContactMentor(mentor)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Contact
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mentee Status Grid */}
          <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">Mentee Status</h3>
              <p className="text-sm text-gray-600 mt-1">
                Showing {filteredMentees.length} of {mentees.length} mentees
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2"
            >
              📥 Export CSV
            </button>
          </div>

          {/* Search Box */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search by mentee name, business, or mentor..."
                value={menteeSearchQuery}
                onChange={(e) => setMenteeSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {menteeSearchQuery && (
                <button
                  onClick={() => setMenteeSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Bulk Assignment Bar */}
          {selectedMentees.size > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-blue-900">
                    {selectedMentees.size} mentee{selectedMentees.size !== 1 ? 's' : ''} selected
                  </span>
                  <select
                    value={bulkAssignMentor}
                    onChange={(e) => setBulkAssignMentor(e.target.value)}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select mentor...</option>
                    {mentors.filter(m => m.availableSlots > 0).map(mentor => (
                      <option key={mentor.id} value={mentor.id}>
                        {mentor.name} ({mentor.availableSlots} slots available)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    disabled={!bulkAssignMentor || assigning}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
                  >
                    {assigning ? 'Assigning...' : 'Assign Selected'}
                  </button>
                </div>
                <button
                  onClick={() => setSelectedMentees(new Set())}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={menteeStatusFilter}
              onChange={(e) => setMenteeStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="MIA">MIA</option>
              <option value="Completed">Completed</option>
              <option value="Dropped">Dropped</option>
            </select>
            <select
              value={menteeProgramFilter}
              onChange={(e) => setMenteeProgramFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="all">All Programs</option>
              {programs.map(program => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
            <select
              value={menteeBatchFilter}
              onChange={(e) => setMenteeBatchFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="all">All Batches</option>
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
            <select
              value={menteeRegionFilter}
              onChange={(e) => setMenteeRegionFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="all">All Regions</option>
              {regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* Select All Checkbox */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMentees.size === filteredMentees.length && filteredMentees.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Select all mentees ({filteredMentees.length})
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMentees.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                No mentees found
              </div>
            ) : (
              filteredMentees.slice(0, 12).map((mentee) => (
                <MenteeCard 
                  key={mentee.id} 
                  mentee={mentee} 
                  selected={selectedMentees.has(mentee.id)}
                  onSelect={() => handleSelectMentee(mentee.id)}
                  onAssign={() => {
                    setSelectedMentee(mentee);
                    setShowAssignModal(true);
                  }} 
                />
              ))
            )}
          </div>

          {filteredMentees.length > 12 && (
            <div className="mt-4 text-center">
              <button className="text-blue-600 hover:text-blue-800 font-medium">
                View all {filteredMentees.length} mentees →
              </button>
            </div>
          )}
        </div>

        {/* Assignment Modal */}
        {showAssignModal && (
          <AssignMentorModal
            mentee={selectedMentee}
            mentors={mentors.filter(m => m.availableSlots > 0)}
            selectedMentor={selectedMentor}
            setSelectedMentor={setSelectedMentor}
            notes={assignmentNotes}
            setNotes={setAssignmentNotes}
            onAssign={handleAssignMentor}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedMentee(null);
              setSelectedMentor('');
              setAssignmentNotes('');
            }}
            assigning={assigning}
          />
        )}

        {/* Unassigned Mentees Table */}
        {unassignedMentees && unassignedMentees.length > 0 && (
          <div ref={unassignedTableRef} className="bg-white rounded-lg shadow overflow-hidden mt-8 scroll-mt-4">
            <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
              <h3 className="text-lg font-semibold text-gray-900">
                ⚠️ Unassigned Mentees ({unassignedMentees.length})
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                These mentees need mentor assignment. Click "Assign" to assign a mentor.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Program / Cohort
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Region
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {unassignedMentees.map((mentee) => (
                    <tr key={mentee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{mentee.name}</div>
                        <div className="text-xs text-gray-500">{mentee.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{mentee.business_name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {mentee.program || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">{mentee.cohort || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mentee.state || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{mentee.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setSelectedMentee({
                              id: mentee.id,
                              name: mentee.name,
                              email: mentee.email,
                              businessName: mentee.business_name,
                              batch: mentee.cohort,
                              region: mentee.state,
                              program: mentee.program
                            });
                            setShowAssignModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => {
                            alert(`Mentee Details:\n\nName: ${mentee.name}\nBusiness: ${mentee.business_name || 'N/A'}\nProgram: ${mentee.program}\nCohort: ${mentee.cohort}\nRegion: ${mentee.state}\nEmail: ${mentee.email}\nPhone: ${mentee.phone || 'N/A'}`);
                          }}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View
                        </button>
                        <a
                          href={`mailto:${mentee.email}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Contact
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// Mentee Card Component
function MenteeCard({ mentee, selected, onSelect, onAssign, onViewDetails }) {
  const statusColors = {
    'Active': 'bg-green-100 text-green-800',
    'MIA': 'bg-red-100 text-red-800',
    'Completed': 'bg-blue-100 text-blue-800',
    'Dropped': 'bg-gray-100 text-gray-800'
  };

  // Extract program from batch name
  const getProgram = (batch) => {
    if (!batch) return 'Unknown';
    const batchLower = batch.toLowerCase();
    if (batchLower.includes('bangkit')) return 'Bangkit';
    if (batchLower.includes('maju')) return 'Maju';
    if (batchLower.includes('tubf')) return 'TUBF';
    return 'Other';
  };

  const getProgramColor = (program) => {
    const colors = {
      'Bangkit': 'bg-blue-100 text-blue-800',
      'Maju': 'bg-green-100 text-green-800',
      'TUBF': 'bg-purple-100 text-purple-800',
      'Other': 'bg-gray-100 text-gray-800'
    };
    return colors[program] || colors['Other'];
  };

  const program = getProgram(mentee.batch);

  const handleViewDetails = () => {
    alert(`Mentee Details:\n\nName: ${mentee.name}\nBusiness: ${mentee.businessName || 'N/A'}\nBatch: ${mentee.batch}\nRegion: ${mentee.region}\nMentor: ${mentee.mentorName}\nEmail: ${mentee.email}\nPhone: ${mentee.phone || 'N/A'}\nStatus: ${mentee.status}\nSessions: ${mentee.sessionsCompleted}/${mentee.totalSessions}\nProgress: ${mentee.progressPercentage}%\nLast Report: ${mentee.daysSinceLastReport} days ago`);
  };

  return (
    <div className={`bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow relative ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Checkbox in top-right corner */}
      <div className="absolute top-3 right-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="mb-3 pr-6">
        <h4 className="font-semibold text-gray-900">{mentee.name}</h4>
        {mentee.businessName && (
          <p className="text-sm text-gray-600">{mentee.businessName}</p>
        )}
        <div className="flex gap-2 mt-2">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getProgramColor(program)}`}>
            {program}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            {mentee.batch}
          </span>
        </div>
      </div>
      
      <div className="space-y-2 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Mentor:</span>
          <span className="font-medium">{mentee.mentorName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Sessions:</span>
          <span className="font-medium">{mentee.sessionsCompleted}/{mentee.totalSessions}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Last Report:</span>
          <span className="font-medium">
            {mentee.daysSinceLastReport >= 999 ? 'Never' : `${mentee.daysSinceLastReport}d ago`}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[mentee.status]}`}>
          {mentee.status}
        </span>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleViewDetails}
          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded"
        >
          View Details
        </button>
        <button 
          onClick={onAssign}
          className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-2 rounded"
        >
          {mentee.mentorId ? 'Reassign' : 'Assign'}
        </button>
      </div>
    </div>
  );
}

// Assignment Modal Component
function AssignMentorModal({ mentee, mentors, selectedMentor, setSelectedMentor, notes, setNotes, onAssign, onClose, assigning }) {
  const mentor = mentors.find(m => m.id === selectedMentor);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4">Assign Mentor to Mentee</h3>
        
        {mentee && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <p className="text-sm font-medium">Mentee: {mentee.name}</p>
            <p className="text-xs text-gray-600">Business: {mentee.businessName}</p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Mentor
          </label>
          <select
            value={selectedMentor}
            onChange={(e) => setSelectedMentor(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">-- Choose Mentor --</option>
            {mentors.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.availableSlots} slots available)
              </option>
            ))}
          </select>
        </div>

        {mentor && (
          <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
            <p className="font-medium">{mentor.name}</p>
            <p className="text-gray-600">{mentor.email}</p>
            <p className="text-gray-600 mt-1">
              Capacity: {mentor.assignedMentees}/{mentor.maxMentees} 
              ({mentor.availableSlots} slots available)
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="3"
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Add any notes about this assignment..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={assigning}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onAssign}
            disabled={!selectedMentor || assigning}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50"
          >
            {assigning ? 'Assigning...' : 'Assign Mentor'}
          </button>
        </div>
      </div>
    </div>
  );
}
