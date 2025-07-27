import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

// --- Reusable UI Components ---

const Select = ({ label, options, value, onChange, disabled = false, required = false }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
    >
      <option value="">Pilih {label}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);

const Input = ({ label, type = 'text', value, onChange, required = false }) => (
    <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            required={required}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    </div>
);

const InfoCard = ({ companyName, address, phone }) => (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
    <h3 className="text-lg font-bold text-gray-800">Maklumat Usahawan</h3>
    <p><strong>Syarikat:</strong> {companyName}</p>
    <p><strong>Alamat:</strong> {address}</p>
    <p><strong>No. Tel:</strong> {phone}</p>
  </div>
);

const Section = ({ title, children }) => (
    <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-6">{title}</h3>
        {children}
    </div>
);


// --- Main Application ---

export default function MentorReportPage() {
  // **NEW**: Get session data for authentication
  const { data: session, status } = useSession();

  // --- State Management ---
  const [mappingData, setMappingData] = useState([]);
  const [frameworkData, setFrameworkData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedMentor, setSelectedMentor] = useState('');
  const [selectedMentee, setSelectedMentee] = useState('');

  // UI control
  const [showForm, setShowForm] = useState(false);
  const [isMenteeDataLoading, setIsMenteeDataLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // Form data
  const [sessionNumber, setSessionNumber] = useState(2);
  const [sessionDetails, setSessionDetails] = useState({ date: '', time: '', platform: '' });
  const [monthlySales, setMonthlySales] = useState(Array(12).fill(''));
  const [previousUpdates, setPreviousUpdates] = useState([]);
  const [sessionSummary, setSessionSummary] = useState('');
  const [decisions, setDecisions] = useState([{ focusArea: '', keputusan: '', recommendations: '' }]);
  const [imageLink, setImageLink] = useState('');

  // --- Data Fetching ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [mappingRes, frameworkRes] = await Promise.all([
          fetch('/api/mapping'),
          fetch('/api/framework'),
        ]);
        if (!mappingRes.ok || !frameworkRes.ok) throw new Error('Failed to fetch initial data');
        const mapping = await mappingRes.json();
        const framework = await frameworkRes.json();
        setMappingData(mapping);
        setFrameworkData(framework);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedMentee) {
      setShowForm(false);
      return;
    }

    const fetchMenteeData = async () => {
      setIsMenteeDataLoading(true);
      setShowForm(false);
      try {
        const res = await fetch(`/api/menteeData?name=${encodeURIComponent(selectedMentee)}`);
        if (!res.ok) throw new Error('Failed to fetch mentee data');
        
        const data = await res.json();
        
        if (data && data.Sesi_Laporan) {
          const match = data.Sesi_Laporan.match(/#(\d+)/);
          const lastSessionNum = match ? parseInt(match[1]) : 1;
          
          setSessionNumber(lastSessionNum + 1);
          setPreviousUpdates(data.previousDecisions.map(d => ({ ...d, update: '' })));
        } else {
          setSessionNumber(2);
          setPreviousUpdates([]);
        }
        
        setShowForm(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsMenteeDataLoading(false);
      }
    };

    fetchMenteeData();
  }, [selectedMentee]);


  // --- Event Handlers ---
  const handleReset = () => {
      setSelectedBatch('');
      setSelectedZone('');
      setSelectedMentor('');
      setSelectedMentee('');
      setShowForm(false);
      setSubmitStatus(null);
      setSessionDetails({ date: '', time: '', platform: '' });
      setMonthlySales(Array(12).fill(''));
      setSessionSummary('');
      setDecisions([{ focusArea: '', keputusan: '', recommendations: '' }]);
      setImageLink('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    const menteeInfo = mappingData.find(item => item.Usahawan === selectedMentee);
    
    const decisionData = [];
    for (let i = 0; i < 4; i++) {
        const d = decisions[i];
        decisionData.push(d?.focusArea || '');
        decisionData.push(d?.keputusan || '');
        decisionData.push(d?.recommendations || '');
    }

    const previousUpdateData = [];
    for (let i = 0; i < 4; i++) {
        const u = previousUpdates[i];
        previousUpdateData.push(u?.update || '');
    }

    const rowData = [
      new Date().toISOString(), // A: Timestamp
      session?.user?.email || '', // B: email from logged-in user
      `Sesi #${sessionNumber}`, // C: Sesi Laporan
      sessionDetails.date, // D: Tarikh Sesi
      sessionDetails.time, // E: Masa Sesi
      sessionDetails.platform, // F: Mod Sesi
      selectedMentee, // G: Nama Usahawan
      menteeInfo?.Nama_Syarikat || '', // H: Nama Bisnes
      ...previousUpdateData, // I-L: Update Keputusan Terdahulu 1-4
      sessionSummary, // M: Ringkasan Sesi
      ...decisionData, // N-Y: Fokus, Keputusan, Cadangan 1-4
      ...monthlySales, // Z-AK: Jualan Jan-Dis
      imageLink, // AL: Link Gambar
    ];

    try {
      const response = await fetch('/api/submitReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowData }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit report');
      }
      setSubmitStatus({ success: true, message: 'Laporan berjaya dihantar!' });
      handleReset();
    } catch (err) {
      setSubmitStatus({ success: false, message: `Gagal menghantar laporan: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Derived State for Dropdowns ---
  const batches = [...new Set(mappingData.map(item => item.Batch))];
  const zones = selectedBatch ? [...new Set(mappingData.filter(item => item.Batch === selectedBatch).map(item => item.Zon))] : [];
  const mentors = selectedZone ? [...new Set(mappingData.filter(item => item.Batch === selectedBatch && item.Zon === selectedZone).map(item => item.Mentor))] : [];
  const mentees = selectedMentor ? mappingData.filter(item => item.Batch === selectedBatch && item.Zon === selectedZone && item.Mentor === selectedMentor).map(item => item.Usahawan) : [];
  const currentMenteeInfo = mappingData.find(item => item.Usahawan === selectedMentee);

  // --- Render Logic ---
  if (status === "loading" || isLoading) return <div className="flex justify-center items-center h-screen"><p>Loading...</p></div>;
  if (error) return <div className="flex justify-center items-center h-screen"><p className="text-red-500">Error: {error}</p></div>;

  return (
    <div className="bg-gray-100 min-h-screen font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-lg">
        
        <header className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">LAPORAN SESI iTEKAD</h1>
            <p className="text-gray-500 mt-1">Versi 10 - Laporan Berterusan</p>
            <div className="flex justify-center items-center space-x-6 mt-6 border-t pt-6">
                <img src="/logo1.png" alt="Sadaqa" className="h-10 sm:h-12" onError={(e) => { e.target.style.display = 'none'; }}/>
                <img src="/logo2.png" alt="Bank Islam" className="h-10 sm:h-12" onError={(e) => { e.target.style.display = 'none'; }}/>
                <img src="/logo3.png" alt="iTekad" className="h-10 sm:h-12" onError={(e) => { e.target.style.display = 'none'; }}/>
                <img src="/logo4.png" alt="StartLah" className="h-10 sm:h-12" onError={(e) => { e.target.style.display = 'none'; }}/>
            </div>
        </header>

        {/* **NEW**: Conditional rendering based on login status */}
        {!session ? (
          <div className="text-center">
            <p className="mb-4">Sila log masuk untuk mengakses borang laporan.</p>
            <button
              onClick={() => signIn('google')}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Log Masuk dengan Google
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <p>Selamat datang, <strong>{session.user.name}</strong>!</p>
              <button
                onClick={() => signOut()}
                className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
              >
                Log Keluar
              </button>
            </div>

            <Section title="1. Pilih Usahawan">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Select label="Batch" options={batches} value={selectedBatch} onChange={e => { setSelectedBatch(e.target.value); setSelectedZone(''); setSelectedMentor(''); setSelectedMentee(''); }} />
                <Select label="Zon" options={zones} value={selectedZone} onChange={e => { setSelectedZone(e.target.value); setSelectedMentor(''); setSelectedMentee(''); }} disabled={!selectedBatch} />
                <Select label="Mentor" options={mentors} value={selectedMentor} onChange={e => { setSelectedMentor(e.target.value); setSelectedMentee(''); }} disabled={!selectedZone} />
                <Select label="Usahawan" options={mentees} value={selectedMentee} onChange={e => setSelectedMentee(e.target.value)} disabled={!selectedMentor} />
              </div>
            </Section>

            {isMenteeDataLoading && <p className="text-center">Loading Mentee Data...</p>}
            
            {showForm && currentMenteeInfo && (
              <form onSubmit={handleSubmit}>
                <InfoCard companyName={currentMenteeInfo.Nama_Syarikat} address={currentMenteeInfo.Alamat} phone={currentMenteeInfo.No_Tel} />
                
                <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">Borang Laporan Sesi #{sessionNumber}</h2>

                <Section title="2. Maklumat Sesi">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input label="Tarikh Sesi" type="date" value={sessionDetails.date} onChange={e => setSessionDetails({...sessionDetails, date: e.target.value})} required />
                        <Input label="Masa Sesi" type="time" value={sessionDetails.time} onChange={e => setSessionDetails({...sessionDetails, time: e.target.value})} required />
                        <Select label="Platform" options={['Face to Face', 'Zoom', 'Google Meet', 'WhatsApp Call']} value={sessionDetails.platform} onChange={e => setSessionDetails({...sessionDetails, platform: e.target.value})} required/>
                    </div>
                </Section>

                <Section title="3. Data Jualan Bulanan (RM)">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'].map((month, i) => (
                            <Input key={month} label={month} type="number" value={monthlySales[i]} onChange={e => { const newSales = [...monthlySales]; newSales[i] = e.target.value; setMonthlySales(newSales); }} />
                        ))}
                    </div>
                </Section>

                {previousUpdates.length > 0 && (
                  <Section title="4. Kemaskini Sesi Terdahulu">
                    {previousUpdates.map((item, index) => (
                      <div key={index} className="mb-4 bg-gray-50 p-3 rounded-lg">
                        <p><strong>Keputusan #{index + 1}:</strong> {item.keputusan}</p>
                        <p><strong>Cadangan Tindakan:</strong> {item.tindakan}</p>
                        <label className="block text-sm font-semibold text-gray-600 mt-2 mb-1">Kemaskini Kemajuan</label>
                        <textarea value={item.update} onChange={e => { const newUpdates = [...previousUpdates]; newUpdates[index].update = e.target.value; setPreviousUpdates(newUpdates); }} className="w-full p-2 border border-gray-300 rounded-md" rows="3" required />
                      </div>
                    ))}
                  </Section>
                )}

                <Section title="5. Ringkasan Sesi & Pemerhatian Mentor (Pilihan)">
                    <textarea
                        value={sessionSummary}
                        onChange={(e) => setSessionSummary(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="5"
                        placeholder="Tulis ringkasan atau pemerhatian penting dari sesi ini..."
                    />
                </Section>

                <Section title="6. Bina Langkah Kehadapan">
                    <div className="mb-4">
                        <Select label="Bilangan Keputusan Baru" options={[1, 2, 3, 4]} value={decisions.length} onChange={e => setDecisions(Array(parseInt(e.target.value)).fill().map((_, i) => decisions[i] || { focusArea: '', keputusan: '', recommendations: '' }))} />
                    </div>
                    {decisions.map((decision, index) => {
                        const focusAreas = [...new Set(frameworkData.map(item => item.Focus_Area))];
                        const keputusanOptions = decision.focusArea ? frameworkData.filter(item => item.Focus_Area === decision.focusArea).map(item => item.Keputusan) : [];
                        const tindakan = frameworkData.find(item => item.Keputusan === decision.keputusan);
                        return (
                            <div key={index} className="border p-4 rounded-lg mb-4">
                                <h4 className="font-bold mb-2">Keputusan #{index + 1}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Select label="Fokus Area" options={focusAreas} value={decision.focusArea} onChange={e => { const newDecisions = [...decisions]; newDecisions[index] = { ...decision, focusArea: e.target.value, keputusan: '' }; setDecisions(newDecisions); }} required />
                                    <Select label="Keputusan" options={keputusanOptions} value={decision.keputusan} onChange={e => { const newDecisions = [...decisions]; newDecisions[index].keputusan = e.target.value; setDecisions(newDecisions); }} disabled={!decision.focusArea} required />
                                </div>
                                {tindakan && (
                                    <div className="mt-4 bg-yellow-50 p-3 rounded-lg text-sm">
                                        <p><strong>Cadangan Tindakan 1:</strong> {tindakan.Tindakan_1}</p>
                                        <p><strong>Cadangan Tindakan 2:</strong> {tindakan.Tindakan_2}</p>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Pelan Tindakan Terperinci</label>
                                    <textarea value={decision.recommendations} onChange={e => { const newDecisions = [...decisions]; newDecisions[index].recommendations = e.target.value; setDecisions(newDecisions); }} className="w-full p-2 border border-gray-300 rounded-md" rows="4" required />
                                </div>
                            </div>
                        )
                    })}
                </Section>

                <Section title="7. Muat Naik Gambar Sesi">
                    <div className="text-center">
                        <a href={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_URL || '#'} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
                            Buka Folder Gambar
                        </a>
                        <p className="text-xs text-gray-500 mt-2">Sila muat naik gambar sesi ke folder dan tampal pautan perkongsian di bawah.</p>
                    </div>
                    <div className="mt-4">
                        <Input label="Pautan Gambar Sesi" value={imageLink} onChange={e => setImageLink(e.target.value)} required />
                    </div>
                </Section>

                <div className="mt-8">
                    <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-lg">
                        {isSubmitting ? 'Menghantar...' : 'Hantar Laporan'}
                    </button>
                </div>

                {submitStatus && (
                    <div className={`mt-4 text-center p-3 rounded-lg ${submitStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {submitStatus.message}
                    </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
