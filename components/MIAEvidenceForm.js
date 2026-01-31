import React from 'react';

const FileInput = ({ label, name, onChange, required, accept = "image/*" }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type="file"
            name={name}
            onChange={onChange}
            accept={accept}
            className="block w-full text-sm text-gray-500
        file:mr-4 file:py-2 file:px-4
        file:rounded-md file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-50 file:text-blue-700
        hover:file:bg-blue-100"
        />
        <p className="mt-1 text-xs text-gray-500">Supported formats: Images (JPG, PNG)</p>
    </div>
);

const MIAEvidenceForm = ({
    miaReason,
    setMiaReason,
    onFileChange,
    files = {}
}) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-red-100">
            <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Laporan Bukti MIA (Wajib)
            </h3>

            <div className="mb-6 p-4 bg-red-50 rounded-md text-sm text-red-700">
                <p className="font-semibold mb-2">Sila muat naik bukti percubaan menghubungi usahawan:</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Bukti mestilah menunjukkan sekurang-kurangnya <strong>3 kali percubaan</strong> bagi setiap saluran.</li>
                    <li>Sila gabungkan screenshot jika perlu (format imej sahaja).</li>
                </ul>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Alasan / Ringkasan Situasi MIA <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={miaReason}
                        onChange={(e) => setMiaReason(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                        rows={4}
                        placeholder="Jelaskan secara ringkas situasi MIA..."
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <h4 className="font-semibold text-gray-700 mb-3">1. Bukti Panggilan Telefon (3 Percubaan)</h4>
                        <FileInput
                            label="Muat Naik Screenshot Log Panggilan"
                            name="proof_call"
                            onChange={(e) => onFileChange('proof_call', e.target.files[0])}
                            required
                        />
                        {files.proof_call && <p className="text-xs text-green-600 font-medium">✓ File selected: {files.proof_call.name}</p>}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <h4 className="font-semibold text-gray-700 mb-3">2. Bukti WhatsApp (3 Percubaan)</h4>
                        <FileInput
                            label="Muat Naik Screenshot Chat WhatsApp"
                            name="proof_whatsapp"
                            onChange={(e) => onFileChange('proof_whatsapp', e.target.files[0])}
                            required
                        />
                        {files.proof_whatsapp && <p className="text-xs text-green-600 font-medium">✓ File selected: {files.proof_whatsapp.name}</p>}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 md:col-span-2">
                        <h4 className="font-semibold text-gray-700 mb-3">3. Bukti Email (3 Percubaan)</h4>
                        <FileInput
                            label="Muat Naik Screenshot 'Sent Items' / Email"
                            name="proof_email"
                            onChange={(e) => onFileChange('proof_email', e.target.files[0])}
                            required
                        />
                        {files.proof_email && <p className="text-xs text-green-600 font-medium">✓ File selected: {files.proof_email.name}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MIAEvidenceForm;
