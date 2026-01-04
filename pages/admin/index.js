import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

const CollapseIcon = ({ is_open }) => (
    <svg className={`w-6 h-6 transition-transform duration-200 ${is_open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
    </svg>
);

export default function AdminDashboard({ userEmail, isReadOnlyUser, accessDenied }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openBatches, setOpenBatches] = useState({});

  // If access is denied, show AccessDenied component
  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  const fetchData = () => {
    setLoading(true);
    setError(null);
    // Add timestamp to prevent browser caching
    fetch(`/api/admin/sales-status?t=${Date.now()}`, {
      cache: 'no-store'
    })
      .then(res => {
        if (!res.ok) throw new Error(`API responded with status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        setBatches(data);
        if (data.length > 0) {
          setOpenBatches({ 0: true });
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const toggleBatch = (index) => {
    setOpenBatches(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) return <p className="text-center p-10">Loading report data...</p>;
  if (error) return <p className="text-red-500 text-center p-10">Error loading data: {error}</p>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {/* Read-Only Badge */}
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      {/* Navigation to Progress Dashboard */}
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
        >
          <span className="text-xl">📊</span>
          <span>View Progress Dashboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Admin Dashboard - Status Laporan Jualan
        </h1>
        <button
          onClick={fetchData}
          disabled={loading || isReadOnlyUser}
          className={`px-4 py-2 rounded-lg transition-colors font-medium ${
            isReadOnlyUser
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
          title={isReadOnlyUser ? 'View-only access - refresh disabled' : ''}
        >
          {loading ? 'Loading...' : '🔄 Refresh Data'}
        </button>
      </div>
      {Array.isArray(batches) && batches.length > 0 ? (
        batches.map((batch, i) => (
          <div key={i} className="mb-4 border rounded-lg shadow-lg bg-white overflow-hidden">
            <button
              onClick={() => toggleBatch(i)}
              className="w-full flex justify-between items-center text-left p-4 bg-white hover:bg-gray-50"
            >
              <h2 className="text-2xl font-bold text-blue-800">
                {batch.batchName} <span className="text-xl font-semibold text-gray-600 ml-2">({batch.roundLabel})</span>
              </h2>
              <CollapseIcon is_open={openBatches[i]} />
            </button>
            
            {openBatches[i] && (
              <div className="p-4 border-t">
                {batch.zones.map((zone, z_idx) => (
                  <div key={z_idx} className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 bg-gray-100 p-2 rounded-t-md">📍 Zon: {zone.zoneName}</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Mentor</th>
                            <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">Mentees</th>
                            <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">Sesi Dilaporkan</th>
                            <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">Sales Data Done</th>
                            <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600 w-1/4">Kemajuan</th>
                            <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">MIA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zone.mentors.map((mentor, index) => (
                            <tr key={index} className="text-center hover:bg-gray-50">
                              <td className="py-3 px-4 border-b text-left">{mentor.mentorName}</td>
                              <td className="py-3 px-4 border-b">{mentor.totalMentees}</td>
                              <td className="py-3 px-4 border-b">{mentor.totalSessions} / {mentor.expectedSessions}</td>
                              <td className="py-3 px-4 border-b">{mentor.salesDataCount} / {mentor.totalSessions}</td>
                              <td className="py-3 px-4 border-b">
                                <div className="flex items-center justify-center">
                                  <div className="w-full bg-gray-200 rounded-full h-4 mr-2">
                                    <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${mentor.percent}%` }}></div>
                                  </div>
                                  <span className="text-sm text-gray-700">{mentor.percent}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 border-b">{mentor.miaCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500 mt-10">No batch data available to display.</p>
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