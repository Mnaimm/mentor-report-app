import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';
import {
  MIA_STATUS,
  getMIAStatusLabel,
  getMIAStatusBadgeClasses,
  generateBIMBMessage,
  copyToClipboard,
  formatTimestamp
} from '../../lib/mia';

export default function MIAAdminPage({ userEmail, isReadOnlyUser, accessDenied }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState({});
  const [copySuccess, setCopySuccess] = useState({});
  const ITEMS_PER_PAGE = 20;

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mia-requests');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch MIA requests');
      }

      setRequests(json.data || []);
    } catch (err) {
      console.error('Error fetching MIA requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Toggle row expansion
  const toggleRow = (requestId) => {
    setExpandedRows(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  // Handle copy BIMB message
  const handleCopyBIMBMessage = async (request) => {
    const menteeData = {
      mentee_name: request.mentee_name,
      mentee_company: request.mentee_company,
      mentee_business_type: request.mentee_business_type,
      mentee_location: request.mentee_location,
      mentee_phone: request.mentee_phone
    };

    const message = generateBIMBMessage(menteeData, request.program, request.batch);
    const success = await copyToClipboard(message);

    if (success) {
      setCopySuccess({ ...copySuccess, [request.id]: true });
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [request.id]: false }));
      }, 2000);
    } else {
      alert('Gagal menyalin mesej. Sila cuba lagi.');
    }
  };

  // Update MIA request status
  const updateRequestStatus = async (requestId, newStatus, rejectionReason = null) => {
    if (isReadOnlyUser) {
      alert('Anda tidak mempunyai akses untuk mengubah status MIA.');
      return;
    }

    setActionLoading({ ...actionLoading, [requestId]: true });

    try {
      const res = await fetch('/api/admin/mia-requests/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status: newStatus,
          adminEmail: userEmail,
          rejectionReason
        })
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to update status');
      }

      // Refresh data
      await fetchRequests();
      alert('Status MIA berjaya dikemaskini!');
    } catch (err) {
      console.error('Error updating status:', err);
      alert(`Gagal mengemas kini status: ${err.message}`);
    } finally {
      setActionLoading({ ...actionLoading, [requestId]: false });
    }
  };

  // Handle status actions
  const handleBIMBContacted = (requestId) => {
    if (confirm('Adakah anda sudah menghubungi BIMB untuk kes ini?')) {
      updateRequestStatus(requestId, MIA_STATUS.BIMB_CONTACTED);
    }
  };

  const handleApprove = (requestId) => {
    if (confirm('Adakah anda pasti untuk meluluskan MIA ini?')) {
      updateRequestStatus(requestId, MIA_STATUS.APPROVED);
    }
  };

  const handleReject = (requestId) => {
    const reason = prompt('Sila nyatakan sebab penolakan MIA:');
    if (reason && reason.trim() !== '') {
      updateRequestStatus(requestId, MIA_STATUS.REJECTED, reason.trim());
    }
  };

  // Filtering
  const filteredRequests = requests.filter(request => {
    if (filterProgram !== 'all' && request.program !== filterProgram) return false;
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats calculation
  const stats = {
    total: requests.length,
    requested: requests.filter(r => r.status === MIA_STATUS.REQUESTED).length,
    bimbContacted: requests.filter(r => r.status === MIA_STATUS.BIMB_CONTACTED).length,
    approved: requests.filter(r => r.status === MIA_STATUS.APPROVED).length,
    rejected: requests.filter(r => r.status === MIA_STATUS.REJECTED).length
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Pengurusan MIA (Missing In Action)
        </h1>
        <nav className="text-sm text-gray-600">
          <Link href="/admin" className="hover:text-blue-600">Admin</Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-gray-800">MIA Requests</span>
        </nav>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-400">
          <p className="text-gray-500 text-sm font-medium">Jumlah Permohonan</p>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-400">
          <p className="text-gray-500 text-sm font-medium">Menunggu Semakan</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.requested}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-medium">BIMB Dihubungi</p>
          <p className="text-3xl font-bold text-blue-600">{stats.bimbContacted}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-400">
          <p className="text-gray-500 text-sm font-medium">Diluluskan</p>
          <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-400">
          <p className="text-gray-500 text-sm font-medium">Ditolak</p>
          <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Program Filter */}
          <select
            value={filterProgram}
            onChange={(e) => {
              setFilterProgram(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Semua Program</option>
            <option value="bangkit">iTEKAD Bangkit</option>
            <option value="maju">iTEKAD Maju</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Semua Status</option>
            <option value={MIA_STATUS.REQUESTED}>Menunggu Semakan</option>
            <option value={MIA_STATUS.BIMB_CONTACTED}>BIMB Dihubungi</option>
            <option value={MIA_STATUS.APPROVED}>Diluluskan</option>
            <option value={MIA_STATUS.REJECTED}>Ditolak</option>
          </select>

          {/* Spacer */}
          <div></div>

          {/* Refresh Button */}
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading MIA requests...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">Error: {error}</div>
        ) : paginatedRequests.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Tiada permohonan MIA ditemui</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Mentor / Mentee</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Syarikat</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Program / Batch</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Tarikh</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedRequests.map((request) => (
                    <React.Fragment key={request.id}>
                      {/* Main Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{request.mentor_name}</div>
                          <div className="text-sm text-gray-500">{request.mentee_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{request.mentee_company || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="font-medium text-gray-900">
                            {request.program === 'bangkit' ? 'Bangkit' : 'Maju'}
                          </div>
                          <div className="text-sm text-gray-500">{request.batch} - Sesi {request.session_number}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm text-gray-700">{formatTimestamp(request.requested_at)}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getMIAStatusBadgeClasses(request.status)}`}>
                            {getMIAStatusLabel(request.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleRow(request.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {expandedRows[request.id] ? '▲ Tutup' : '▼ Lihat Butiran'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {expandedRows[request.id] && (
                        <tr>
                          <td colSpan="6" className="px-6 py-6 bg-gray-50">
                            <div className="space-y-6">
                              {/* Mentee Details */}
                              <div>
                                <h4 className="font-semibold text-gray-800 mb-3">Maklumat Usahawan</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Jenis Bisnes:</span>
                                    <span className="ml-2 text-gray-800">{request.mentee_business_type || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Lokasi:</span>
                                    <span className="ml-2 text-gray-800">{request.mentee_location || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">No. Telefon:</span>
                                    <span className="ml-2 text-gray-800">{request.mentee_phone || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* MIA Reason */}
                              <div>
                                <h4 className="font-semibold text-gray-800 mb-2">Alasan MIA</h4>
                                <p className="text-sm text-gray-700 bg-white p-4 rounded-lg border">
                                  {request.alasan}
                                </p>
                              </div>

                              {/* Proof Images */}
                              <div>
                                <h4 className="font-semibold text-gray-800 mb-3">Bukti Percubaan Menghubungi</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* WhatsApp Proof */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Bukti WhatsApp</p>
                                    {request.proof_whatsapp_url ? (
                                      <a
                                        href={request.proof_whatsapp_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={request.proof_whatsapp_url}
                                          alt="WhatsApp Proof"
                                          className="w-full h-48 object-cover rounded border cursor-pointer hover:opacity-80"
                                        />
                                      </a>
                                    ) : (
                                      <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                                        Tiada bukti
                                      </div>
                                    )}
                                  </div>

                                  {/* Email Proof */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Bukti E-mel</p>
                                    {request.proof_email_url ? (
                                      <a
                                        href={request.proof_email_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={request.proof_email_url}
                                          alt="Email Proof"
                                          className="w-full h-48 object-cover rounded border cursor-pointer hover:opacity-80"
                                        />
                                      </a>
                                    ) : (
                                      <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                                        Tiada bukti
                                      </div>
                                    )}
                                  </div>

                                  {/* Call Proof */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Bukti Panggilan</p>
                                    {request.proof_call_url ? (
                                      <a
                                        href={request.proof_call_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={request.proof_call_url}
                                          alt="Call Proof"
                                          className="w-full h-48 object-cover rounded border cursor-pointer hover:opacity-80"
                                        />
                                      </a>
                                    ) : (
                                      <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                                        Tiada bukti
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-3 pt-4 border-t">
                                {/* Copy BIMB Message */}
                                <button
                                  onClick={() => handleCopyBIMBMessage(request)}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                                >
                                  {copySuccess[request.id] ? '✓ Disalin!' : '📋 Salin Mesej BIMB'}
                                </button>

                                {/* BIMB Contacted */}
                                {request.status === MIA_STATUS.REQUESTED && (
                                  <button
                                    onClick={() => handleBIMBContacted(request.id)}
                                    disabled={actionLoading[request.id] || isReadOnlyUser}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading[request.id] ? 'Processing...' : '✉️ BIMB Dah Dihubungi'}
                                  </button>
                                )}

                                {/* Approve */}
                                {(request.status === MIA_STATUS.REQUESTED || request.status === MIA_STATUS.BIMB_CONTACTED) && (
                                  <button
                                    onClick={() => handleApprove(request.id)}
                                    disabled={actionLoading[request.id] || isReadOnlyUser}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading[request.id] ? 'Processing...' : '✅ Luluskan MIA'}
                                  </button>
                                )}

                                {/* Reject */}
                                {(request.status === MIA_STATUS.REQUESTED || request.status === MIA_STATUS.BIMB_CONTACTED) && (
                                  <button
                                    onClick={() => handleReject(request.id)}
                                    disabled={actionLoading[request.id] || isReadOnlyUser}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading[request.id] ? 'Processing...' : '❌ Tolak MIA'}
                                  </button>
                                )}

                                {/* Show rejection reason if rejected */}
                                {request.status === MIA_STATUS.REJECTED && request.rejection_reason && (
                                  <div className="w-full mt-2">
                                    <p className="text-sm font-medium text-red-600">Sebab Ditolak:</p>
                                    <p className="text-sm text-gray-700 bg-red-50 p-3 rounded border border-red-200 mt-1">
                                      {request.rejection_reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} requests
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Server-side authentication and authorization
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
      accessDenied: false,
    },
  };
}
