import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function MyReports({ userEmail, reports: initialReports }) {
    const router = useRouter();
    const [reports, setReports] = useState(initialReports || []);
    const [activeFilter, setActiveFilter] = useState('all');

    // Calculate status counts
    const statusCounts = {
        all: reports.length,
        review_requested: reports.filter(r => r.status === 'review_requested').length,
        submitted: reports.filter(r => r.status === 'submitted').length,
        approved: reports.filter(r => r.status === 'approved' && r.payment_status === 'pending').length,
        paid: reports.filter(r => r.payment_status === 'approved_for_payment').length,
        rejected: reports.filter(r => r.status === 'rejected').length,
    };

    // Filter and sort reports
    const getFilteredReports = () => {
        let filtered = reports;

        if (activeFilter !== 'all') {
            if (activeFilter === 'review_requested') {
                filtered = reports.filter(r => r.status === 'review_requested');
            } else if (activeFilter === 'submitted') {
                filtered = reports.filter(r => r.status === 'submitted');
            } else if (activeFilter === 'approved') {
                filtered = reports.filter(r => r.status === 'approved' && r.payment_status === 'pending');
            } else if (activeFilter === 'paid') {
                filtered = reports.filter(r => r.payment_status === 'approved_for_payment');
            } else if (activeFilter === 'rejected') {
                filtered = reports.filter(r => r.status === 'rejected');
            }
        }

        // Sort: review_requested to top, then by submission date (newest first)
        return filtered.sort((a, b) => {
            if (a.status === 'review_requested' && b.status !== 'review_requested') return -1;
            if (b.status === 'review_requested' && a.status !== 'review_requested') return 1;
            return new Date(b.submission_date) - new Date(a.submission_date);
        });
    };

    const filteredReports = getFilteredReports();

    // Determine which form to link to based on program
    const getFormUrl = (report) => {
        const program = report.program?.toUpperCase() || '';

        if (program.includes('MAJU')) {
            return `/laporan-maju-um?mode=revision&reportId=${report.id}`;
        } else if (program.includes('BANGKIT') || program.includes('TUBF')) {
            return `/laporan-bangkit?mode=revision&reportId=${report.id}`;
        }

        // Default to Bangkit form
        return `/laporan-bangkit?mode=revision&reportId=${report.id}`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Laporan Saya</h1>
                            <p className="text-gray-600 mt-1">Semak status laporan yang telah anda hantar</p>
                        </div>
                        <Link
                            href="/mentor/dashboard"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            ← Kembali ke Dashboard
                        </Link>
                    </div>

                    {/* Alert Banner for Revision Requests */}
                    {statusCounts.review_requested > 0 && (
                        <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-amber-800">
                                        Anda mempunyai <span className="font-bold">{statusCounts.review_requested} laporan</span> yang memerlukan semakan semula
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Filter Chips */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-wrap gap-2">
                        <FilterChip
                            label="Semua"
                            count={statusCounts.all}
                            active={activeFilter === 'all'}
                            onClick={() => setActiveFilter('all')}
                            color="gray"
                        />
                        <FilterChip
                            label="Perlu Semakan"
                            count={statusCounts.review_requested}
                            active={activeFilter === 'review_requested'}
                            onClick={() => setActiveFilter('review_requested')}
                            color="amber"
                        />
                        <FilterChip
                            label="Dalam Semakan"
                            count={statusCounts.submitted}
                            active={activeFilter === 'submitted'}
                            onClick={() => setActiveFilter('submitted')}
                            color="blue"
                        />
                        <FilterChip
                            label="Diluluskan"
                            count={statusCounts.approved}
                            active={activeFilter === 'approved'}
                            onClick={() => setActiveFilter('approved')}
                            color="green"
                        />
                        <FilterChip
                            label="Dibayar"
                            count={statusCounts.paid}
                            active={activeFilter === 'paid'}
                            onClick={() => setActiveFilter('paid')}
                            color="emerald"
                        />
                        <FilterChip
                            label="Ditolak"
                            count={statusCounts.rejected}
                            active={activeFilter === 'rejected'}
                            onClick={() => setActiveFilter('rejected')}
                            color="red"
                        />
                    </div>
                </div>
            </div>

            {/* Report Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {filteredReports.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <div className="text-6xl mb-4">📄</div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            {activeFilter === 'all'
                                ? 'Anda belum menghantar sebarang laporan'
                                : 'Tiada laporan dalam kategori ini'}
                        </h3>
                        <p className="text-gray-500">
                            {activeFilter === 'all' && 'Mulakan dengan menghantar laporan mentoring pertama anda'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredReports.map((report) => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                formUrl={getFormUrl(report)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Filter Chip Component
function FilterChip({ label, count, active, onClick, color }) {
    const colorClasses = {
        gray: active ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        amber: active ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
        blue: active ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        green: active ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200',
        emerald: active ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
        red: active ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200',
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${colorClasses[color]}`}
        >
            {label} <span className="ml-1 font-bold">({count})</span>
        </button>
    );
}

// Report Card Component
function ReportCard({ report, formUrl }) {
    const getStatusConfig = () => {
        if (report.status === 'review_requested') {
            return {
                label: 'Perlu Semakan',
                color: 'amber',
                stripeColor: 'bg-amber-500',
                bgColor: 'bg-amber-50',
                textColor: 'text-amber-800',
                borderColor: 'border-amber-300'
            };
        } else if (report.status === 'rejected') {
            return {
                label: 'Ditolak',
                color: 'red',
                stripeColor: 'bg-red-500',
                bgColor: 'bg-red-50',
                textColor: 'text-red-800',
                borderColor: 'border-red-300'
            };
        } else if (report.payment_status === 'approved_for_payment') {
            return {
                label: 'Dibayar',
                color: 'emerald',
                stripeColor: '',
                bgColor: 'bg-emerald-50',
                textColor: 'text-emerald-800',
                borderColor: 'border-emerald-300'
            };
        } else if (report.status === 'approved') {
            return {
                label: 'Diluluskan',
                color: 'green',
                stripeColor: '',
                bgColor: 'bg-green-50',
                textColor: 'text-green-800',
                borderColor: 'border-green-300'
            };
        } else {
            return {
                label: 'Dalam Semakan',
                color: 'blue',
                stripeColor: '',
                bgColor: 'bg-blue-50',
                textColor: 'text-blue-800',
                borderColor: 'border-blue-300'
            };
        }
    };

    const statusConfig = getStatusConfig();

    // Progress timeline steps
    const steps = [
        { label: 'Dihantar', completed: true },
        { label: 'Dalam Semakan', completed: report.status !== 'submitted' || report.status === 'approved' || report.status === 'rejected' },
        { label: 'Diluluskan', completed: report.status === 'approved' || report.payment_status === 'approved_for_payment' },
        { label: 'Dibayar', completed: report.payment_status === 'approved_for_payment' }
    ];

    // If rejected or review_requested, timeline shows different path
    if (report.status === 'rejected' || report.status === 'review_requested') {
        steps[1].completed = true; // Marked as reviewed
        steps[2].completed = false;
        steps[3].completed = false;
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ms-MY', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            {/* Top Stripe for Revision/Rejection */}
            {statusConfig.stripeColor && (
                <div className={`h-1 ${statusConfig.stripeColor}`}></div>
            )}

            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{report.mentee_name || report.nama_usahawan}</h3>
                        {(report.nama_syarikat || report.nama_bisnes) && (
                            <p className="text-sm text-gray-600 mt-1">{report.nama_syarikat || report.nama_bisnes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                                {report.program} - Sesi {report.session_number}
                            </span>
                            <span className={`px-3 py-1 ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} text-xs font-semibold rounded-full border`}>
                                {statusConfig.label}
                            </span>
                        </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                        <p>Dihantar</p>
                        <p className="font-medium text-gray-700">{formatDate(report.submission_date)}</p>
                    </div>
                </div>

                {/* Progress Timeline */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <React.Fragment key={index}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                                        step.completed
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-400'
                                    }`}>
                                        {step.completed ? '✓' : index + 1}
                                    </div>
                                    <p className={`text-xs mt-2 font-medium ${
                                        step.completed ? 'text-gray-700' : 'text-gray-400'
                                    }`}>
                                        {step.label}
                                    </p>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`flex-1 h-1 mx-2 ${
                                        step.completed ? 'bg-green-500' : 'bg-gray-200'
                                    }`}></div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Revision Request Details */}
                {report.status === 'review_requested' && (
                    <div className="mb-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r">
                        <h4 className="font-semibold text-amber-900 mb-2">Perkara yang perlu diperbaiki:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                            {(report.revision_reason || []).map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                            ))}
                        </ul>
                        {report.revision_notes && (
                            <div className="mt-3 pt-3 border-t border-amber-200">
                                <p className="text-sm font-medium text-amber-900">Nota tambahan:</p>
                                <p className="text-sm text-amber-800 mt-1">{report.revision_notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Rejection Notice */}
                {report.status === 'rejected' && (
                    <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r">
                        <p className="text-sm font-medium text-red-900">
                            Laporan ini telah ditolak. Sila hubungi koordinator program untuk maklumat lanjut.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {report.status === 'review_requested' && (
                        <Link
                            href={formUrl}
                            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-center transition-colors"
                        >
                            📝 Edit & Hantar Semula
                        </Link>
                    )}

                    {(report.document_url || report.doc_url) && (
                        <a
                            href={report.document_url || report.doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-center transition-colors"
                        >
                            📄 Lihat Dokumen
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

export async function getServerSideProps(context) {
    const session = await getSession(context);

    // Redirect to login if not authenticated
    if (!session) {
        return {
            redirect: {
                destination: '/login',
                permanent: false
            }
        };
    }

    const userEmail = session.user.email;

    // Fetch reports for this mentor
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: reports, error } = await supabase
            .from('reports')
            .select('*')
            .eq('mentor_email', userEmail)
            .order('submission_date', { ascending: false });

        if (error) {
            console.error('Error fetching reports:', error);
            return {
                props: {
                    userEmail,
                    reports: []
                }
            };
        }

        return {
            props: {
                userEmail,
                reports: reports || []
            }
        };
    } catch (err) {
        console.error('Error in getServerSideProps:', err);
        return {
            props: {
                userEmail,
                reports: []
            }
        };
    }
}
