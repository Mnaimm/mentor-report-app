import React, { useState, useEffect } from 'react';

const REVISION_CATEGORIES = [
    'Gambar sesi tidak ada / tidak mencukupi',
    'Latar belakang usahawan tidak mencukupi',
    'Tiada gambar Growth Wheel',
    'Tiada data kewangan',
    'Maklumat Upward Mobility tidak ada / tidak mencukupi',
    'Tiada ulasan Upward Mobility',
    'Lain-lain'
];

export default function RejectReportModal({ isOpen, onClose, onSubmit, isSubmitting }) {
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [otherNotes, setOtherNotes] = useState('');

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedCategories([]);
            setOtherNotes('');
        }
    }, [isOpen]);

    const toggleCategory = (category) => {
        setSelectedCategories(prev => {
            if (prev.includes(category)) {
                return prev.filter(c => c !== category);
            } else {
                return [...prev, category];
            }
        });
    };

    const isOtherSelected = selectedCategories.includes('Lain-lain');
    const canSubmit = selectedCategories.length > 0 && (!isOtherSelected || otherNotes.trim());

    const handleSubmit = () => {
        if (!canSubmit) return;

        onSubmit({
            revision_reasons: selectedCategories,
            revision_notes: isOtherSelected ? otherNotes.trim() : ''
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-900">Minta Semakan Semula</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Pilih kategori yang perlu diperbaiki oleh mentor
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        {REVISION_CATEGORIES.map((category, index) => (
                            <div key={index}>
                                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(category)}
                                        onChange={() => toggleCategory(category)}
                                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="flex-1 text-sm font-medium text-gray-800">
                                        {category}
                                    </span>
                                </label>

                                {/* Show text field when "Lain-lain" is selected */}
                                {category === 'Lain-lain' && isOtherSelected && (
                                    <div className="ml-8 mt-2">
                                        <textarea
                                            value={otherNotes}
                                            onChange={(e) => setOtherNotes(e.target.value)}
                                            placeholder="Sila nyatakan perkara lain yang perlu diperbaiki..."
                                            rows="3"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                        {isOtherSelected && !otherNotes.trim() && (
                                            <p className="text-xs text-red-600 mt-1">
                                                * Sila isi butiran untuk kategori "Lain-lain"
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Validation Message */}
                    {selectedCategories.length === 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">
                                ⚠️ Sila pilih sekurang-kurangnya satu kategori
                            </p>
                        </div>
                    )}

                    {/* Summary */}
                    {selectedCategories.length > 0 && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-semibold text-blue-900 text-sm mb-2">
                                Ringkasan Semakan ({selectedCategories.length} kategori)
                            </h4>
                            <ul className="text-xs text-blue-800 space-y-1">
                                {selectedCategories.map((cat, idx) => (
                                    <li key={idx}>• {cat}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                    >
                        {isSubmitting ? 'Menghantar...' : 'Hantar Permintaan Semakan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
