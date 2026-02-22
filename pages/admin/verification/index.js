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
    const [filterMonth, setFilterMonth] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    if (accessDenied) {
        return <AccessDenied userEmail={userEmail} />;
    }

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/reports?status=submitted');
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

    // Filtering
    // Filtering
    const filteredReports = reports.filter(report => {
        // Dropdown filter: exact match on Mentor Name if selected
        if (searchQuery && report.mentor_name !== searchQuery) {
            return false;
        }

        if (filterMonth !== 'all') {
            const reportDate = new Date(report.submission_date);
            const monthYear = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
            if (monthYear !== filterMonth) return false;
        }

        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
    const paginatedReports = filteredReports.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Unique Months for Filter
    const uniqueMonths = [...new Set(reports.map(r => {
        const d = new Date(r.submission_date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-400">
                    <p className="text-gray-500 text-sm font-medium">Pending Review</p>
                    <p className="text-3xl font-bold text-gray-800">{reports.length}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-md mb-6">
                {/* Filters Row */}
                <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Mentor Dropdown */}
                    <select
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">All Mentors</option>
                        {[...new Set(reports.map(r => r.mentor_name))].sort().map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>

                    {/* Month Dropdown */}
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="all">Check All Months</option>
                        {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchReports}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 md:col-start-4"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-gray-500">Loading reports...</div>
                ) : error ? (
                    <div className="p-10 text-center text-red-500">Error: {error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Details</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Program/Session</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {paginatedReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{report.mentor_name}</div>
                                            <div className="text-sm text-gray-500">{report.mentee_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 font-medium">{report.program}</div>
                                            <div className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full inline-block">
                                                Session {report.session_number}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-600">
                                            {new Date(report.submission_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Link
                                                href={`/admin/verification/${report.id}`}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                            >
                                                Review
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedReports.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-gray-500">
                                            No pending reports found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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
            accessDenied: !hasAccess
        }
    };
}
