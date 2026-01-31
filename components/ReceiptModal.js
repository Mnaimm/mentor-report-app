import React, { useState } from 'react';
import { useRouter } from 'next/router';

const ReceiptModal = ({
    isOpen,
    onClose,
    submissionId,
    submittedAt,
    menteeName,
    sessionNumber,
    program
}) => {
    const router = useRouter();
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(submissionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDashboard = () => {
        router.push('/mentor/dashboard');
    };

    // Format date if it's a date string/object
    const formattedDate = submittedAt
        ? new Date(submittedAt).toLocaleString('en-MY', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        })
        : '-';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">

                {/* Header - Teal/Green as per design */}
                <div className="bg-teal-700 p-4 flex items-center justify-between text-white">
                    <div className="flex items-center space-x-3 mx-auto">
                        <div className="bg-green-500 rounded-full p-1">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold">Laporan Diterima oleh Sistem</h3>
                    </div>
                    <button onClick={onClose} className="text-white hover:text-gray-200 focus:outline-none absolute right-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <label className="block text-gray-700 font-bold mb-2 text-lg">ID Penghantaran:</label>

                    <div className="flex items-center bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                        <span className="text-xl font-mono font-bold text-gray-800 flex-1 truncate mr-2">
                            {submissionId || 'Pending ID...'}
                        </span>
                        <button
                            onClick={handleCopy}
                            className={`flex items-center px-3 py-1.5 rounded border shadow-sm text-sm font-medium transition-colors ${copied
                                    ? 'bg-green-100 text-green-700 border-green-300'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {copied ? (
                                <>
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                    Disalin
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                                    </svg>
                                    Salin ID
                                </>
                            )}
                        </button>
                    </div>

                    <div className="space-y-3 text-sm text-gray-700 border-b pb-6 mb-4">
                        <div className="flex">
                            <span className="w-32 text-gray-500">• Tarikh & Masa:</span>
                            <span className="font-medium">{formattedDate}</span>
                        </div>
                        <div className="flex">
                            <span className="w-32 text-gray-500">• Nama Usahawan:</span>
                            <span className="font-medium">{menteeName}</span>
                        </div>
                        <div className="flex">
                            <span className="w-32 text-gray-500">• Sesi:</span>
                            <span className="font-medium">#{sessionNumber}</span>
                        </div>
                        <div className="flex">
                            <span className="w-32 text-gray-500">• Program:</span>
                            <span className="font-bold text-teal-800">{program}</span>
                        </div>
                    </div>

                    <p className="text-gray-500 text-sm italic mb-6">
                        Simpan ID ini sebagai rujukan sekiranya berlaku sebarang isu.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <button
                            onClick={handleDashboard}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300 font-medium transition-colors flex items-center justify-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                            Kembali ke Dashboard
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-md font-bold transition-colors shadow-sm"
                        >
                            Tutup
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
