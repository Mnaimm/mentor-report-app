import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../../lib/auth';
import AccessDenied from '../../../components/AccessDenied';

export default function ReviewReport({ userEmail, isReadOnlyUser, accessDenied }) {
    const router = useRouter();
    const { id } = router.query;
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    useEffect(() => {
        if (id) fetchReport();
    }, [id]);

    const fetchReport = async () => {
        try {
            const res = await fetch(`/api/admin/reports/${id}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            setReport(json.data);
        } catch (err) {
            console.error(err);
            alert('Error fetching report');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (status, reason = null) => {
        if (!confirm(`Are you sure you want to ${status.toUpperCase()} this report?`)) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/reports/${id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, rejectionReason: reason })
            });

            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            alert(`Report ${status} successfully!`);
            router.push('/admin/verification');
        } catch (err) {
            alert(`Failed to update status: ${err.message}`);
        } finally {
            setActionLoading(false);
            setShowRejectModal(false);
        }
    };

    if (accessDenied) return <AccessDenied userEmail={userEmail} />;
    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Report...</div>;
    if (!report) return <div className="p-10 text-center">Report not found</div>;

    return (
        <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-white shadow-sm border-b px-6 py-3 flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <Link href="/admin/verification" className="text-gray-500 hover:text-gray-700">
                        ← Back
                    </Link>
                    <h1 className="text-lg font-bold text-gray-800">
                        Scanning: {report.mentor_name}
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {report.program} - Session {report.session_number}
                        </span>
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading || isReadOnlyUser}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium disabled:opacity-50"
                    >
                        ❌ Reject
                    </button>
                    <button
                        onClick={() => handleReview('approved')}
                        disabled={actionLoading || isReadOnlyUser}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm disabled:opacity-50"
                    >
                        {actionLoading ? 'Processing...' : '✅ Approve & Pay'}
                    </button>
                </div>
            </div>

            {/* Main Split Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Auto-Check Compliance (30%) */}
                <div className="w-[30%] bg-white border-r overflow-y-auto p-6 scrollbar-thin">
                    <div className="space-y-6">

                        {/* 1. Mentee Profile (Minimal) */}
                        <div className="p-4 bg-gray-50 rounded-lg border">
                            <h3 className="font-semibold text-gray-900 mb-1">{report.mentee_name}</h3>
                            <p className="text-sm text-gray-600">{report.nama_syarikat}</p>
                            <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-2">
                                <div>
                                    <span className="block font-medium">Program</span>
                                    {report.program}
                                </div>
                                <div>
                                    <span className="block font-medium">Session</span>
                                    #{report.session_number}
                                </div>
                            </div>
                        </div>

                        {/* 2. Automated Compliance Checks */}
                        <div>
                            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                🤖 Auto-Compliance Check
                            </h3>

                            <div className="space-y-3">
                                {/* Check 1: Session Photo */}
                                <ComplianceItem
                                    label="Session Photo Evidence"
                                    passed={report.image_urls?.sesi?.length > 0}
                                    subtext={report.image_urls?.sesi?.length > 0 ? "Photo attached" : "Missing session photo"}
                                />

                                {/* Check 2: Initiatives/Findings Submitted */}
                                <ComplianceItem
                                    label="Key Decision Points"
                                    passed={((report.inisiatif || []).length > 0) || ((report.mentoring_findings || []).length > 0)}
                                    subtext={`${(report.inisiatif || []).length + (report.mentoring_findings || []).length} items recorded`}
                                />

                                {/* Check 3: GrowthWheel (Bangkit Session 1 Only) */}
                                {report.program === 'Bangkit' && report.session_number == 1 && (
                                    <ComplianceItem
                                        label="GrowthWheel Chart"
                                        passed={!!report.image_urls?.growthwheel}
                                        subtext={report.image_urls?.growthwheel ? "Chart attached" : "Required for Session 1"}
                                    />
                                )}

                                {/* Check 4: Premises Visit (If claimed) */}
                                {report.premis_dilawat && (
                                    <ComplianceItem
                                        label="Premises Visit Evidence"
                                        passed={(report.image_urls?.premis || []).length > 0}
                                        subtext={(report.image_urls?.premis || []).length > 0 ? "Photos attached" : "Visit claimed but no photos"}
                                    />
                                )}

                                {/* Check 5: MIA Status */}
                                {report.status === 'MIA' && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                        <div className="text-xl">⚠️</div>
                                        <div>
                                            <p className="font-bold text-red-800 text-sm">Mentee Marked MIA</p>
                                            <p className="text-xs text-red-600 mt-1">Check proof if available.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Validation Summary */}
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                            <h4 className="font-bold text-blue-900 text-sm mb-2">Validation Summary</h4>
                            <ul className="text-xs text-blue-800 space-y-1">
                                <li>• Date: {new Date(report.submission_date).toLocaleDateString()}</li>
                                <li>• Platform: {report.mod_sesi || 'N/A'}</li>
                                <li>• Payment Status: <span className="font-bold">{report.payment_status || 'Pending'}</span></li>
                            </ul>
                        </div>

                    </div>
                </div>

                {/* Right Panel: Document Viewer (70%) */}
                <div className="w-[70%] bg-gray-100 flex flex-col p-4 relative">
                    {report.document_url && (
                        <div className="flex justify-end mb-2">
                            <a
                                href={report.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-white px-3 py-1 rounded shadow-sm"
                            >
                                <span>📄 Open in new tab</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    )}
                    <div className="flex-1 bg-white rounded-lg shadow-lg border overflow-hidden">
                        {report.document_url ? (
                            <iframe
                                src={(() => {
                                    const url = report.document_url;

                                    // Robust Embed Strategy: Use Local Proxy to Stream Content
                                    // This bypasses X-Frame-Options and Auth wall entirely

                                    // Extract ID from docs/drive link
                                    const docId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
                                    if (docId) {
                                        return `/api/admin/proxy-drive/${docId}`;
                                    }

                                    // Fallback for non-Drive URLs
                                    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
                                })()}
                                className="w-full h-full rounded-lg shadow-lg border bg-white"
                                title="Document Preview"
                            />
                        ) : (
                            <div className="text-center p-8 bg-white rounded-lg shadow">
                                <div className="text-5xl mb-4">📄</div>
                                <h3 className="text-xl font-semibold text-gray-700">Document URL Not Found</h3>
                                <p className="text-gray-500 mt-2">The system attempted to fetch the URL but failed.</p>
                                <p className="text-xs text-gray-400 mt-4">Row: {report.sheets_row_number}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Reject Report</h3>
                        <textarea
                            className="w-full p-3 border rounded-lg mb-4 text-sm"
                            rows="4"
                            placeholder="Reason for rejection (will be sent to mentor)..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReview('rejected', rejectionReason)}
                                disabled={!rejectionReason.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ComplianceItem({ label, passed, subtext }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-white border rounded-lg shadow-sm">
            <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {passed ? '✓' : '✕'}
            </div>
            <div>
                <p className="font-medium text-gray-800 text-sm">{label}</p>
                <p className={`text-xs ${passed ? 'text-gray-500' : 'text-red-500 font-semibold'}`}>{subtext}</p>
            </div>
        </div>
    );
}

export async function getServerSideProps(context) {
    const session = await getSession(context);
    if (!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };

    const userEmail = session.user.email;
    const hasAccess = await canAccessAdmin(userEmail);
    const isReadOnlyUser = await isReadOnly(userEmail);

    return { props: { userEmail, isReadOnlyUser, accessDenied: !hasAccess } };
}
