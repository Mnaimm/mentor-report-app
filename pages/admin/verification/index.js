import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../../lib/auth';
import AccessDenied from '../../../components/AccessDenied';
import ReadOnlyBadge from '../../../components/ReadOnlyBadge';

export default function VerificationDashboard({ userEmail, isReadOnlyUser, accessDenied }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterBatch, setFilterBatch] = useState('all');
    const [filterPusingan, setFilterPusingan] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterMentor, setFilterMentor] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [statsFilter, setStatsFilter] = useState('all'); // Track which stat card is active
    const ITEMS_PER_PAGE = 20;

    if (accessDenied) {
        return <AccessDenied userEmail={userEmail} />;
    }

    const fetchReports = async () => {
        setLoading(true);
        try {
            // Fetch all reports (status=all)
            const res = await fetch('/api/admin/reports?status=all&limit=1000');
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to fetch reports');
            setReports(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    // Helper to categorize report status
    const getReportCategory = (report) => {
        // Note: API currently doesn't return payment_status, mia_status, premis_dilawat
        // These checks are placeholders until API is updated
        const paymentStatus = report.payment_status || 'pending';
        const miaStatus = report.mia_status || 'Tidak MIA';

        if (miaStatus === 'MIA') return 'mia';
        if (!report.submission_date) return 'belum_masuk';
        if (paymentStatus === 'approved_for_payment') return 'disemak';
        if (report.status === 'submitted' && paymentStatus === 'pending') return 'menunggu_semakan';
        return 'other';
    };

    // Calculate stats
    const stats = {
        jumlah: reports.length,
        belum_masuk: reports.filter(r => !r.submission_date && getReportCategory(r) !== 'mia').length,
        menunggu_semakan: reports.filter(r => getReportCategory(r) === 'menunggu_semakan').length,
        disemak: reports.filter(r => getReportCategory(r) === 'disemak').length,
    };

    // Filtering
    const filteredReports = reports.filter(report => {
        // Stats card filter
        if (statsFilter !== 'all') {
            const category = getReportCategory(report);
            if (statsFilter !== category) return false;
        }

        // Batch filter
        if (filterBatch !== 'all') {
            if (!report.program || !report.program.includes(filterBatch)) return false;
        }

        // Pusingan (session) filter
        if (filterPusingan !== 'all') {
            if (report.session_number !== parseInt(filterPusingan)) return false;
        }

        // Status filter
        if (filterStatus !== 'all') {
            const category = getReportCategory(report);
            if (filterStatus !== category) return false;
        }

        // Mentor filter
        if (filterMentor && report.mentor_name !== filterMentor) {
            return false;
        }

        return true;
    });

    // Calculate verified stats from filtered reports
    const verifiedReports = filteredReports.filter(r => getReportCategory(r) === 'disemak');
    const verifiedCount = verifiedReports.length;
    const totalAmount = verifiedReports.reduce((sum, r) => sum + (r.base_payment_amount || 0), 0);

    // Pagination
    const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
    const paginatedReports = filteredReports.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Get unique mentor names
    const uniqueMentors = [...new Set(reports.map(r => r.mentor_name))].sort();

    // Batch options
    const batchOptions = ['B4-M3', 'B5-M4', 'B6-M5', 'B7-M6', 'BBG MAIPk', 'BBG MULA UKM'];

    // Helper to get status dot color
    const getStatusDotColor = (report) => {
        const category = getReportCategory(report);
        if (category === 'belum_masuk') return 'bg-red-500';
        if (category === 'menunggu_semakan') return 'bg-amber-500';
        if (category === 'disemak') return 'bg-green-500';
        if (category === 'mia') return 'bg-gray-400';
        return 'bg-gray-300';
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Modul Pengesahan Laporan</h1>
                <nav className="text-sm text-gray-600">
                    <Link href="/admin" className="hover:text-blue-600">Admin</Link>
                    <span className="mx-2">/</span>
                    <span className="font-medium text-gray-800">Verification</span>
                </nav>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Jumlah */}
                <button
                    onClick={() => setStatsFilter(statsFilter === 'all' ? 'all' : 'all')}
                    className={`bg-white p-6 rounded-xl shadow-md border-l-4 text-left transition-all hover:shadow-lg ${
                        statsFilter === 'all' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-400'
                    }`}
                >
                    <p className="text-gray-500 text-sm font-medium">Jumlah</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.jumlah}</p>
                    <p className="text-xs text-gray-500 mt-1">Semua laporan</p>
                </button>

                {/* Belum Masuk */}
                <button
                    onClick={() => setStatsFilter(statsFilter === 'belum_masuk' ? 'all' : 'belum_masuk')}
                    className={`bg-white p-6 rounded-xl shadow-md border-l-4 text-left transition-all hover:shadow-lg ${
                        statsFilter === 'belum_masuk' ? 'border-red-500 ring-2 ring-red-200' : 'border-red-400'
                    }`}
                >
                    <p className="text-gray-500 text-sm font-medium">Belum Masuk</p>
                    <p className="text-3xl font-bold text-red-600">{stats.belum_masuk}</p>
                    <p className="text-xs text-gray-500 mt-1">Tiada submission_date</p>
                </button>

                {/* Menunggu Semakan */}
                <button
                    onClick={() => setStatsFilter(statsFilter === 'menunggu_semakan' ? 'all' : 'menunggu_semakan')}
                    className={`bg-white p-6 rounded-xl shadow-md border-l-4 text-left transition-all hover:shadow-lg ${
                        statsFilter === 'menunggu_semakan' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-400'
                    }`}
                >
                    <p className="text-gray-500 text-sm font-medium">Menunggu Semakan</p>
                    <p className="text-3xl font-bold text-amber-600">{stats.menunggu_semakan}</p>
                    <p className="text-xs text-gray-500 mt-1">Payment pending</p>
                </button>

                {/* Disemak */}
                <button
                    onClick={() => setStatsFilter(statsFilter === 'disemak' ? 'all' : 'disemak')}
                    className={`bg-white p-6 rounded-xl shadow-md border-l-4 text-left transition-all hover:shadow-lg ${
                        statsFilter === 'disemak' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-400'
                    }`}
                >
                    <p className="text-gray-500 text-sm font-medium">Disemak</p>
                    <p className="text-3xl font-bold text-green-600">{stats.disemak}</p>
                    <p className="text-xs text-gray-500 mt-1">Payment approved</p>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-md mb-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Batch Selector */}
                    <select
                        value={filterBatch}
                        onChange={(e) => {
                            setFilterBatch(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="all">Semua Batch</option>
                        {batchOptions.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                        ))}
                    </select>

                    {/* Pusingan Selector */}
                    <select
                        value={filterPusingan}
                        onChange={(e) => {
                            setFilterPusingan(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="all">Semua Pusingan</option>
                        <option value="1">Pusingan 1</option>
                        <option value="2">Pusingan 2</option>
                        <option value="3">Pusingan 3</option>
                        <option value="4">Pusingan 4</option>
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
                        <option value="belum_masuk">Belum Masuk</option>
                        <option value="menunggu_semakan">Menunggu Semakan</option>
                        <option value="disemak">Disemak</option>
                        <option value="mia">MIA</option>
                    </select>

                    {/* Mentor Dropdown */}
                    <select
                        value={filterMentor}
                        onChange={(e) => {
                            setFilterMentor(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">Semua Mentor</option>
                        {uniqueMentors.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchReports}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
                {loading ? (
                    <div className="p-10 text-center text-gray-500">Loading reports...</div>
                ) : error ? (
                    <div className="p-10 text-center text-red-500">Error: {error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Mentor</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Mentee</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Program</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Tarikh Masuk</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Bayaran</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Nota</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {paginatedReports.map((report) => {
                                    const category = getReportCategory(report);
                                    const isVerified = category === 'disemak';
                                    const isPremis = report.premis_dilawat || false;
                                    const isMIA = report.mia_status === 'MIA';

                                    return (
                                        <tr key={report.id} className="hover:bg-gray-50">
                                            {/* Status Dot */}
                                            <td className="px-4 py-4">
                                                <div className="flex justify-center">
                                                    <div className={`w-3 h-3 rounded-full ${getStatusDotColor(report)}`} title={category}></div>
                                                </div>
                                            </td>

                                            {/* Mentor Name */}
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{report.mentor_name}</div>
                                            </td>

                                            {/* Mentee Name with badges */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-900">{report.mentee_name}</span>
                                                    {isPremis && (
                                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold" title="Lawatan Premis">
                                                            LP
                                                        </span>
                                                    )}
                                                    {isMIA && (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold" title="Missing In Action">
                                                            MIA
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Program + Session */}
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 font-medium">{report.program || '-'}</div>
                                                <div className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full inline-block mt-1">
                                                    Sesi {report.session_number}
                                                </div>
                                            </td>

                                            {/* Tarikh Masuk */}
                                            <td className="px-6 py-4 text-center text-sm text-gray-600">
                                                {report.submission_date
                                                    ? new Date(report.submission_date).toLocaleDateString('ms-MY')
                                                    : '-'
                                                }
                                            </td>

                                            {/* Bayaran */}
                                            <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                                                {report.base_payment_amount
                                                    ? `RM ${report.base_payment_amount.toFixed(2)}`
                                                    : '-'
                                                }
                                            </td>

                                            {/* Nota */}
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-600 max-w-xs truncate" title={report.verification_nota || ''}>
                                                    {report.verification_nota
                                                        ? (report.verification_nota.length > 40
                                                            ? report.verification_nota.substring(0, 40) + '...'
                                                            : report.verification_nota)
                                                        : '-'
                                                    }
                                                </div>
                                            </td>

                                            {/* Action */}
                                            <td className="px-6 py-4 text-center">
                                                {isVerified ? (
                                                    <span className="px-3 py-1 text-green-700 text-sm font-semibold">
                                                        ✓ Disemak
                                                    </span>
                                                ) : (
                                                    <Link
                                                        href={`/admin/verification/${report.id}`}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium inline-block"
                                                    >
                                                        Review
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedReports.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-10 text-center text-gray-500">
                                            Tiada laporan dijumpai.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mb-6">
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

            {/* Progress Footer */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">
                                {verifiedCount} daripada {filteredReports.length} laporan disemak
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                                {filteredReports.length > 0
                                    ? Math.round((verifiedCount / filteredReports.length) * 100)
                                    : 0
                                }%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                                style={{
                                    width: `${filteredReports.length > 0
                                        ? (verifiedCount / filteredReports.length) * 100
                                        : 0
                                    }%`
                                }}
                            ></div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600">Jumlah sedia bayar</p>
                        <p className="text-2xl font-bold text-green-600">
                            RM {totalAmount.toFixed(2)}
                        </p>
                    </div>
                </div>
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
            accessDenied: !hasAccess
        }
    };
}
