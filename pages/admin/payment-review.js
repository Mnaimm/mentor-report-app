import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessPaymentAdmin } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';

// Toast Notification Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';

    return (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className={`${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
                <span className="text-lg">{type === 'success' ? '✓' : '✗'}</span>
                <span className="flex-1">{message}</span>
                <button onClick={onClose} className="text-white hover:text-gray-200">
                    ×
                </button>
            </div>
        </div>
    );
};

export default function PaymentReview({ userEmail, accessDenied }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'history', 'summary'
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReports, setSelectedReports] = useState(new Set());
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [confirmStep, setConfirmStep] = useState(false); // For confirmation inside modal
    const [batchCreating, setBatchCreating] = useState(false);
    const [filterBatch, setFilterBatch] = useState('all');
    const [expandedMentors, setExpandedMentors] = useState(new Set());
    const [toast, setToast] = useState(null);

    // Batch history & summary data
    const [batches, setBatches] = useState([]);
    const [mentorSummary, setMentorSummary] = useState([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);

    // Mark paid modal state
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [markPaidForm, setMarkPaidForm] = useState({ paidDate: '', bankRef: '' });

    // Batch form state
    const [batchForm, setBatchForm] = useState({
        batchName: '',
        paymentDate: '',
        notes: '',
        approvedBy: ''
    });

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (activeTab === 'queue') {
            fetchApprovedReports();
        } else if (activeTab === 'history') {
            fetchBatches();
        } else if (activeTab === 'summary') {
            fetchMentorSummary();
        }
    }, [activeTab]);

    const fetchApprovedReports = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/payment/approved-reports');
            const json = await res.json();
            if (json.success) {
                setReports(json.data || []);
            } else {
                throw new Error(json.error);
            }
        } catch (err) {
            console.error('Error fetching approved reports:', err);
            showToast('Failed to fetch reports: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchBatches = async () => {
        setLoadingBatches(true);
        try {
            const res = await fetch('/api/admin/payment/batches');
            if (!res.ok) {
                // API doesn't exist yet
                setBatches([]);
                return;
            }
            const json = await res.json();
            if (json.success) {
                setBatches(json.data || []);
            }
        } catch (err) {
            console.error('Error fetching batches:', err);
            setBatches([]);
        } finally {
            setLoadingBatches(false);
        }
    };

    const fetchMentorSummary = async () => {
        setLoadingSummary(true);
        try {
            const res = await fetch('/api/admin/payment/mentor-summary');
            if (!res.ok) {
                // API doesn't exist yet
                setMentorSummary([]);
                return;
            }
            const json = await res.json();
            if (json.success) {
                setMentorSummary(json.data || []);
            }
        } catch (err) {
            console.error('Error fetching mentor summary:', err);
            setMentorSummary([]);
        } finally {
            setLoadingSummary(false);
        }
    };

    const toggleReport = (reportId) => {
        const newSelected = new Set(selectedReports);
        if (newSelected.has(reportId)) {
            newSelected.delete(reportId);
        } else {
            newSelected.add(reportId);
        }
        setSelectedReports(newSelected);
    };

    const toggleMentor = (mentorEmail) => {
        const mentorReports = getFilteredReports().filter(r => r.mentor_email === mentorEmail);
        const mentorReportIds = mentorReports.map(r => r.id);
        const allSelected = mentorReportIds.every(id => selectedReports.has(id));

        const newSelected = new Set(selectedReports);
        if (allSelected) {
            mentorReportIds.forEach(id => newSelected.delete(id));
        } else {
            mentorReportIds.forEach(id => newSelected.add(id));
        }
        setSelectedReports(newSelected);
    };

    const toggleMentorExpand = (mentorEmail) => {
        const newExpanded = new Set(expandedMentors);
        if (newExpanded.has(mentorEmail)) {
            newExpanded.delete(mentorEmail);
        } else {
            newExpanded.add(mentorEmail);
        }
        setExpandedMentors(newExpanded);
    };

    const toggleAll = () => {
        const filtered = getFilteredReports();
        if (selectedReports.size === filtered.length) {
            setSelectedReports(new Set());
        } else {
            setSelectedReports(new Set(filtered.map(r => r.id)));
        }
    };

    const getFilteredReports = () => {
        if (filterBatch === 'all') return reports;
        return reports.filter(r => r.program && r.program.includes(filterBatch));
    };

    const getSelectedReports = () => {
        return getFilteredReports().filter(r => selectedReports.has(r.id));
    };

    const calculateTotals = () => {
        const selected = getSelectedReports();
        const totalAmount = selected.reduce((sum, r) => {
            const amount = r.adjusted_payment_amount || r.base_payment_amount || 0;
            return sum + parseFloat(amount);
        }, 0);

        // Group by mentor
        const byMentor = {};
        selected.forEach(r => {
            const mentorKey = r.mentor_email;
            if (!byMentor[mentorKey]) {
                byMentor[mentorKey] = {
                    name: r.mentor_name || r.mentor_email,
                    count: 0,
                    amount: 0
                };
            }
            byMentor[mentorKey].count++;
            byMentor[mentorKey].amount += parseFloat(r.adjusted_payment_amount || r.base_payment_amount || 0);
        });

        return {
            totalReports: selected.length,
            totalAmount,
            byMentor: Object.values(byMentor)
        };
    };

    const groupByMentor = (reportsList) => {
        const grouped = {};
        reportsList.forEach(report => {
            const key = report.mentor_email;
            if (!grouped[key]) {
                grouped[key] = {
                    mentor_name: report.mentor_name || report.mentor_email,
                    mentor_email: report.mentor_email,
                    reports: [],
                    totalAmount: 0,
                    totalSessions: 0
                };
            }
            grouped[key].reports.push(report);
            grouped[key].totalSessions++;
            grouped[key].totalAmount += parseFloat(report.adjusted_payment_amount || report.base_payment_amount || 0);
        });
        return Object.values(grouped);
    };

    const handleCreateBatch = async () => {
        if (!batchForm.batchName.trim()) {
            showToast('Please enter a batch name', 'error');
            return;
        }
        if (!batchForm.paymentDate) {
            showToast('Please select a payment date', 'error');
            return;
        }
        if (!batchForm.approvedBy) {
            showToast('Please select approver', 'error');
            return;
        }
        if (selectedReports.size === 0) {
            showToast('Please select at least one report', 'error');
            return;
        }

        if (!confirmStep) {
            setConfirmStep(true);
            return;
        }

        setBatchCreating(true);
        try {
            const res = await fetch('/api/admin/payment/create-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchName: batchForm.batchName,
                    paymentDate: batchForm.paymentDate,
                    notes: batchForm.notes,
                    approvedBy: batchForm.approvedBy,
                    reportIds: Array.from(selectedReports)
                })
            });

            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            showToast(`Payment batch created successfully! Batch ID: ${json.batchId}`, 'success');

            // Reset state
            setShowBatchModal(false);
            setConfirmStep(false);
            setSelectedReports(new Set());
            setBatchForm({ batchName: '', paymentDate: '', notes: '', approvedBy: '' });

            // Refresh list
            fetchApprovedReports();
        } catch (err) {
            console.error('Error creating batch:', err);
            showToast('Failed to create batch: ' + err.message, 'error');
        } finally {
            setBatchCreating(false);
        }
    };

    const handleMarkPaid = async () => {
        if (!markPaidForm.paidDate) {
            showToast('Please enter payment date', 'error');
            return;
        }

        try {
            const res = await fetch('/api/admin/payment/mark-paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchId: selectedBatch.id,
                    paidDate: markPaidForm.paidDate,
                    bankRef: markPaidForm.bankRef
                })
            });

            if (!res.ok) {
                throw new Error('API endpoint not available');
            }

            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            showToast('Batch marked as paid successfully', 'success');
            setShowMarkPaidModal(false);
            setSelectedBatch(null);
            setMarkPaidForm({ paidDate: '', bankRef: '' });
            fetchBatches();
        } catch (err) {
            console.error('Error marking as paid:', err);
            showToast('Failed to mark as paid: ' + err.message, 'error');
        }
    };

    if (accessDenied) return <AccessDenied userEmail={userEmail} />;

    const totals = calculateTotals();
    const filteredReports = getFilteredReports();
    const groupedMentors = groupByMentor(filteredReports);
    const batchOptions = ['B4-M3', 'B5-M4', 'B6-M5', 'B7-M6', 'BBG MAIPk', 'BBG MULA UKM'];
    const approvers = ['Naim NM', 'Yusry YY', 'Noraminah NO'];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Payment Review</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Review and process approved reports for payment
                            </p>
                        </div>
                        <Link href="/admin" className="text-blue-600 hover:text-blue-800 font-medium">
                            ← Back to Admin
                        </Link>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'queue'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Giliran Bayaran
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'history'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Sejarah Batch
                        </button>
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'summary'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Ringkasan Mentor
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* TAB 1: GILIRAN BAYARAN */}
                {activeTab === 'queue' && (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="text-sm font-medium text-gray-600">Total Reports</div>
                                <div className="text-3xl font-bold text-gray-900 mt-2">{filteredReports.length}</div>
                                <div className="text-xs text-gray-500 mt-1">Approved & ready for payment</div>
                            </div>

                            <div className="bg-blue-50 rounded-lg shadow p-6 border-2 border-blue-200">
                                <div className="text-sm font-medium text-blue-900">Selected Reports</div>
                                <div className="text-3xl font-bold text-blue-700 mt-2">{totals.totalReports}</div>
                                <div className="text-xs text-blue-600 mt-1">
                                    {totals.byMentor.length} mentor(s)
                                </div>
                            </div>

                            <div className="bg-green-50 rounded-lg shadow p-6 border-2 border-green-200">
                                <div className="text-sm font-medium text-green-900">Total Amount</div>
                                <div className="text-3xl font-bold text-green-700 mt-2">
                                    RM {totals.totalAmount.toFixed(2)}
                                </div>
                                <div className="text-xs text-green-600 mt-1">Selected reports</div>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="bg-white rounded-lg shadow mb-6 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <select
                                    value={filterBatch}
                                    onChange={(e) => setFilterBatch(e.target.value)}
                                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                >
                                    <option value="all">Semua Batch</option>
                                    {batchOptions.map(batch => (
                                        <option key={batch} value={batch}>{batch}</option>
                                    ))}
                                </select>

                                <button
                                    onClick={toggleAll}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                >
                                    {selectedReports.size === filteredReports.length && filteredReports.length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                                <span className="text-sm text-gray-600">
                                    {selectedReports.size} of {filteredReports.length} selected
                                </span>
                            </div>

                            <button
                                onClick={() => setShowBatchModal(true)}
                                disabled={selectedReports.size === 0}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                Create Payment Batch ({selectedReports.size})
                            </button>
                        </div>

                        {/* Grouped by Mentor */}
                        {loading ? (
                            <div className="bg-white rounded-lg shadow p-10 text-center">
                                <div className="text-gray-500">Loading reports...</div>
                            </div>
                        ) : filteredReports.length === 0 ? (
                            <div className="bg-white rounded-lg shadow p-10 text-center">
                                <div className="text-5xl mb-4">✅</div>
                                <h3 className="text-xl font-semibold text-gray-700">No Reports Pending Payment</h3>
                                <p className="text-gray-500 mt-2">All approved reports have been processed.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {groupedMentors.map((mentor) => {
                                    const isExpanded = expandedMentors.has(mentor.mentor_email);
                                    const mentorReportIds = mentor.reports.map(r => r.id);
                                    const allSelected = mentorReportIds.every(id => selectedReports.has(id));
                                    const someSelected = mentorReportIds.some(id => selectedReports.has(id));

                                    return (
                                        <div key={mentor.mentor_email} className="bg-white rounded-lg shadow overflow-hidden">
                                            {/* Mentor Header */}
                                            <div className="bg-gray-50 border-b p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelected}
                                                        ref={input => {
                                                            if (input) input.indeterminate = someSelected && !allSelected;
                                                        }}
                                                        onChange={() => toggleMentor(mentor.mentor_email)}
                                                        className="w-5 h-5"
                                                    />
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-gray-900">{mentor.mentor_name}</h3>
                                                        <p className="text-sm text-gray-600">{mentor.mentor_email}</p>
                                                    </div>
                                                    <div className="text-right mr-4">
                                                        <div className="text-sm text-gray-600">{mentor.totalSessions} session(s)</div>
                                                        <div className="text-lg font-bold text-green-700">RM {mentor.totalAmount.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleMentorExpand(mentor.mentor_email)}
                                                    className="px-3 py-2 text-gray-600 hover:text-gray-900 font-medium"
                                                >
                                                    {isExpanded ? '▼' : '▶'}
                                                </button>
                                            </div>

                                            {/* Mentor Sessions (Expanded) */}
                                            {isExpanded && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead className="bg-gray-100 border-b text-xs">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left w-12"></th>
                                                                <th className="px-4 py-2 text-left">Mentee</th>
                                                                <th className="px-4 py-2 text-left">Session</th>
                                                                <th className="px-4 py-2 text-left">Premises</th>
                                                                <th className="px-4 py-2 text-right">Base</th>
                                                                <th className="px-4 py-2 text-right">Adjusted</th>
                                                                <th className="px-4 py-2 text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {mentor.reports.map((report) => {
                                                                const isSelected = selectedReports.has(report.id);
                                                                const finalAmount = report.adjusted_payment_amount || report.base_payment_amount || 0;

                                                                return (
                                                                    <tr
                                                                        key={report.id}
                                                                        className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                                                                    >
                                                                        <td className="px-4 py-3">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={() => toggleReport(report.id)}
                                                                                className="w-4 h-4"
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <div className="text-sm text-gray-900">{report.mentee_name}</div>
                                                                            <div className="text-xs text-gray-500">{report.nama_syarikat}</div>
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                                                                                {report.program} S{report.session_number}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm">
                                                                            {report.premis_dilawat ? (
                                                                                <span className="text-green-600 font-medium">Yes</span>
                                                                            ) : (
                                                                                <span className="text-gray-400">No</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                                                                            RM {parseFloat(report.base_payment_amount || 0).toFixed(2)}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-sm">
                                                                            {report.adjusted_payment_amount ? (
                                                                                <span className="text-orange-600 font-medium">
                                                                                    RM {parseFloat(report.adjusted_payment_amount).toFixed(2)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-gray-400">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                                                            RM {parseFloat(finalAmount).toFixed(2)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* TAB 2: SEJARAH BATCH */}
                {activeTab === 'history' && (
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Sejarah Batch Bayaran</h2>
                        {loadingBatches ? (
                            <div className="bg-white rounded-lg shadow p-10 text-center">
                                <div className="text-gray-500">Loading batch history...</div>
                            </div>
                        ) : batches.length === 0 ? (
                            <div className="bg-white rounded-lg shadow p-10 text-center">
                                <div className="text-5xl mb-4">📦</div>
                                <h3 className="text-xl font-semibold text-gray-700">Coming Soon</h3>
                                <p className="text-gray-500 mt-2">Payment batch history will be available here.</p>
                                <p className="text-xs text-gray-400 mt-4">
                                    Note: API endpoint /api/admin/payment/batches needs to be created
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {batches.map((batch) => {
                                    const statusColors = {
                                        pending: 'bg-yellow-100 text-yellow-800',
                                        approved: 'bg-blue-100 text-blue-800',
                                        paid: 'bg-green-100 text-green-800'
                                    };

                                    return (
                                        <div key={batch.id} className="bg-white rounded-lg shadow p-6 border">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-gray-900">{batch.batch_name}</h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[batch.status] || 'bg-gray-100 text-gray-800'}`}>
                                                    {batch.status}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-sm text-gray-600 mb-4">
                                                <div className="flex justify-between">
                                                    <span>Created by:</span>
                                                    <span className="font-medium">{batch.created_by}</span>
                                                </div>
                                                {batch.approved_by && (
                                                    <div className="flex justify-between">
                                                        <span>Approved by:</span>
                                                        <span className="font-medium">{batch.approved_by}</span>
                                                    </div>
                                                )}
                                                {batch.paid_by && (
                                                    <div className="flex justify-between">
                                                        <span>Paid by:</span>
                                                        <span className="font-medium">{batch.paid_by}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span>Date created:</span>
                                                    <span className="font-medium">
                                                        {new Date(batch.created_at).toLocaleDateString('ms-MY')}
                                                    </span>
                                                </div>
                                                {batch.paid_at && (
                                                    <div className="flex justify-between">
                                                        <span>Date paid:</span>
                                                        <span className="font-medium">
                                                            {new Date(batch.paid_at).toLocaleDateString('ms-MY')}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between border-t pt-2">
                                                    <span>Total reports:</span>
                                                    <span className="font-bold">{batch.total_reports}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Total amount:</span>
                                                    <span className="font-bold text-green-700">
                                                        RM {parseFloat(batch.total_amount || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            {batch.notes && (
                                                <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 mb-4">
                                                    <span className="font-medium">Notes: </span>
                                                    {batch.notes}
                                                </div>
                                            )}

                                            {(batch.status === 'pending' || batch.status === 'approved') && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedBatch(batch);
                                                        setShowMarkPaidModal(true);
                                                    }}
                                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                                                >
                                                    Tandakan Berbayar
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: RINGKASAN MENTOR */}
                {activeTab === 'summary' && (
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Ringkasan Bayaran Mentor</h2>
                        {loadingSummary ? (
                            <div className="bg-white rounded-lg shadow p-10 text-center">
                                <div className="text-gray-500">Loading mentor summary...</div>
                            </div>
                        ) : mentorSummary.length === 0 ? (
                            <div className="bg-white rounded-lg shadow p-10 text-center">
                                <div className="text-5xl mb-4">📊</div>
                                <h3 className="text-xl font-semibold text-gray-700">Coming Soon</h3>
                                <p className="text-gray-500 mt-2">Mentor payment summary will be available here.</p>
                                <p className="text-xs text-gray-400 mt-4">
                                    Note: API endpoint /api/admin/payment/mentor-summary needs to be created
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {mentorSummary.map((mentor, idx) => {
                                    const paidPercentage = mentor.sessions_total > 0
                                        ? Math.round((mentor.sessions_paid / mentor.sessions_total) * 100)
                                        : 0;

                                    return (
                                        <div key={idx} className="bg-white rounded-lg shadow p-6 border">
                                            <h3 className="font-bold text-gray-900 mb-4">{mentor.mentor_name}</h3>

                                            <div className="space-y-3 mb-4">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Sessions paid:</span>
                                                    <span className="font-semibold text-green-700">{mentor.sessions_paid}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Sessions pending:</span>
                                                    <span className="font-semibold text-orange-600">{mentor.sessions_pending}</span>
                                                </div>
                                                <div className="flex justify-between text-sm border-t pt-2">
                                                    <span className="text-gray-600">Total paid:</span>
                                                    <span className="font-bold text-green-700">
                                                        RM {parseFloat(mentor.total_paid || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Total pending:</span>
                                                    <span className="font-bold text-orange-600">
                                                        RM {parseFloat(mentor.total_pending || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mb-3">
                                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Progress</span>
                                                    <span>{paidPercentage}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-green-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${paidPercentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {mentor.last_paid_date && (
                                                <div className="text-xs text-gray-500 mt-2">
                                                    Last paid: {new Date(mentor.last_paid_date).toLocaleDateString('ms-MY')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Batch Modal */}
            {showBatchModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b">
                            <h3 className="text-xl font-bold text-gray-900">
                                {confirmStep ? 'Confirm Payment Batch' : 'Create Payment Batch'}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Processing {selectedReports.size} report(s) for RM {totals.totalAmount.toFixed(2)}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {!confirmStep ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Batch Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={batchForm.batchName}
                                            onChange={(e) => setBatchForm({ ...batchForm, batchName: e.target.value })}
                                            placeholder="e.g., 30 January 2026 Payment Round"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Payment Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={batchForm.paymentDate}
                                            onChange={(e) => setBatchForm({ ...batchForm, paymentDate: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Kelulusan Oleh *
                                        </label>
                                        <select
                                            value={batchForm.approvedBy}
                                            onChange={(e) => setBatchForm({ ...batchForm, approvedBy: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        >
                                            <option value="">Select approver</option>
                                            {approvers.map(approver => (
                                                <option key={approver} value={approver}>{approver}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Notes (Optional)
                                        </label>
                                        <textarea
                                            value={batchForm.notes}
                                            onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                                            placeholder="Any additional notes..."
                                            rows="3"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <h4 className="font-bold text-blue-900 mb-3">Please confirm batch creation:</h4>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="flex justify-between">
                                            <span>Batch Name:</span>
                                            <span className="font-semibold">{batchForm.batchName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Payment Date:</span>
                                            <span className="font-semibold">{batchForm.paymentDate}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Approved By:</span>
                                            <span className="font-semibold">{batchForm.approvedBy}</span>
                                        </div>
                                        <div className="flex justify-between border-t pt-2">
                                            <span>Total Reports:</span>
                                            <span className="font-semibold">{selectedReports.size}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Mentors:</span>
                                            <span className="font-semibold">{totals.byMentor.length}</span>
                                        </div>
                                        <div className="flex justify-between border-t pt-2 mt-2">
                                            <span className="font-bold text-gray-900">Total Amount:</span>
                                            <span className="font-bold text-green-700">RM {totals.totalAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            {confirmStep && (
                                <button
                                    onClick={() => setConfirmStep(false)}
                                    disabled={batchCreating}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setShowBatchModal(false);
                                    setConfirmStep(false);
                                }}
                                disabled={batchCreating}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateBatch}
                                disabled={batchCreating}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 shadow-sm"
                            >
                                {batchCreating ? 'Creating...' : (confirmStep ? 'Confirm & Create' : 'Next')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark as Paid Modal */}
            {showMarkPaidModal && selectedBatch && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b">
                            <h3 className="text-xl font-bold text-gray-900">Tandakan Sebagai Berbayar</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Batch: {selectedBatch.batch_name}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tarikh Bayar *
                                </label>
                                <input
                                    type="date"
                                    value={markPaidForm.paidDate}
                                    onChange={(e) => setMarkPaidForm({ ...markPaidForm, paidDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Bank Reference (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={markPaidForm.bankRef}
                                    onChange={(e) => setMarkPaidForm({ ...markPaidForm, bankRef: e.target.value })}
                                    placeholder="e.g., TXN123456789"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                                <div className="flex justify-between mb-1">
                                    <span>Total amount:</span>
                                    <span className="font-bold text-green-700">
                                        RM {parseFloat(selectedBatch.total_amount || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total reports:</span>
                                    <span className="font-semibold">{selectedBatch.total_reports}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowMarkPaidModal(false);
                                    setSelectedBatch(null);
                                    setMarkPaidForm({ paidDate: '', bankRef: '' });
                                }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMarkPaid}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                            >
                                Mark as Paid
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export async function getServerSideProps(context) {
    const session = await getSession(context);
    if (!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };

    const userEmail = session.user.email;
    const hasAccess = await canAccessPaymentAdmin(userEmail);

    return { props: { userEmail, accessDenied: !hasAccess } };
}
