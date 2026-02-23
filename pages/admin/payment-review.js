import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessPaymentAdmin } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';

export default function PaymentReview({ userEmail, accessDenied }) {
    const router = useRouter();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReports, setSelectedReports] = useState(new Set());
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchCreating, setBatchCreating] = useState(false);

    // Batch form state
    const [batchForm, setBatchForm] = useState({
        batchName: '',
        paymentDate: '',
        notes: ''
    });

    useEffect(() => {
        fetchApprovedReports();
    }, []);

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
            alert('Failed to fetch reports: ' + err.message);
        } finally {
            setLoading(false);
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

    const toggleAll = () => {
        if (selectedReports.size === reports.length) {
            setSelectedReports(new Set());
        } else {
            setSelectedReports(new Set(reports.map(r => r.id)));
        }
    };

    const getSelectedReports = () => {
        return reports.filter(r => selectedReports.has(r.id));
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

    const handleCreateBatch = async () => {
        if (!batchForm.batchName.trim()) {
            alert('Please enter a batch name');
            return;
        }
        if (!batchForm.paymentDate) {
            alert('Please select a payment date');
            return;
        }
        if (selectedReports.size === 0) {
            alert('Please select at least one report');
            return;
        }

        if (!confirm(`Create payment batch with ${selectedReports.size} reports for RM ${calculateTotals().totalAmount.toFixed(2)}?`)) {
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
                    reportIds: Array.from(selectedReports)
                })
            });

            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            alert(`Payment batch created successfully!\n\nBatch ID: ${json.batchId}\nTotal Reports: ${selectedReports.size}\nTotal Amount: RM ${calculateTotals().totalAmount.toFixed(2)}`);

            // Reset state
            setShowBatchModal(false);
            setSelectedReports(new Set());
            setBatchForm({ batchName: '', paymentDate: '', notes: '' });

            // Refresh list
            fetchApprovedReports();
        } catch (err) {
            console.error('Error creating batch:', err);
            alert('Failed to create batch: ' + err.message);
        } finally {
            setBatchCreating(false);
        }
    };

    if (accessDenied) return <AccessDenied userEmail={userEmail} />;

    const totals = calculateTotals();

    return (
        <div className="min-h-screen bg-gray-50">
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

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-sm font-medium text-gray-600">Total Reports</div>
                        <div className="text-3xl font-bold text-gray-900 mt-2">{reports.length}</div>
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

                {/* Action Bar */}
                <div className="bg-white rounded-lg shadow mb-6 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleAll}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        >
                            {selectedReports.size === reports.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-sm text-gray-600">
                            {selectedReports.size} of {reports.length} selected
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

                {/* Reports Table */}
                {loading ? (
                    <div className="bg-white rounded-lg shadow p-10 text-center">
                        <div className="text-gray-500">Loading reports...</div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-10 text-center">
                        <div className="text-5xl mb-4">✅</div>
                        <h3 className="text-xl font-semibold text-gray-700">No Reports Pending Payment</h3>
                        <p className="text-gray-500 mt-2">All approved reports have been processed.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={selectedReports.size === reports.length && reports.length > 0}
                                                onChange={toggleAll}
                                                className="w-4 h-4"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mentor</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mentee</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Session</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Premises</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Base</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Adjusted</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Approved</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {reports.map((report) => {
                                        const isSelected = selectedReports.has(report.id);
                                        const finalAmount = report.adjusted_payment_amount || report.base_payment_amount || 0;

                                        return (
                                            <tr
                                                key={report.id}
                                                className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                                                onClick={() => toggleReport(report.id)}
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleReport(report.id)}
                                                        className="w-4 h-4"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {report.mentor_name || report.mentor_email}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {report.bank_account || 'No bank account'}
                                                    </div>
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
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {report.premis_dilawat ? (
                                                        <span className="text-green-600 font-medium">Yes</span>
                                                    ) : (
                                                        <span className="text-gray-400">No</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-900">
                                                    RM {parseFloat(report.base_payment_amount || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-900">
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
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    {new Date(report.approved_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Breakdown by Mentor (if selections exist) */}
                {totals.totalReports > 0 && (
                    <div className="mt-6 bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Breakdown by Mentor</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {totals.byMentor.map((mentor, idx) => (
                                <div key={idx} className="border rounded-lg p-4">
                                    <div className="font-medium text-gray-900">{mentor.name}</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {mentor.count} report{mentor.count > 1 ? 's' : ''}
                                    </div>
                                    <div className="text-lg font-bold text-green-700 mt-2">
                                        RM {mentor.amount.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Batch Modal */}
            {showBatchModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b">
                            <h3 className="text-xl font-bold text-gray-900">Create Payment Batch</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Processing {selectedReports.size} report(s) for RM {totals.totalAmount.toFixed(2)}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
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

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-lg p-4 border">
                                <div className="text-sm font-medium text-gray-700 mb-2">Batch Summary:</div>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <div className="flex justify-between">
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
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setShowBatchModal(false)}
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
                                {batchCreating ? 'Creating...' : 'Create Batch'}
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
