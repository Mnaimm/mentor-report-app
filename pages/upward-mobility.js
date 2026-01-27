// pages/upward-mobility.js
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// --- Icon Components (keeping existing ones) ---
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const BriefcaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;
const TrendingUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
const BankIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="m3 21 18-0"/><path d="M5 21V10l7-5 7 5v11"/><path d="M12 21V10"/><path d="m10 15-1.5-1.5"/><path d="m14 15 1.5-1.5"/><path d="m10 12 2 2 2-2"/></svg>;
const DollarSignIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const LaptopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55A1 1 0 0 1 20.28 20H3.72a1 1 0 0 1-.99-1.45L4 16Z"></path></svg>;

// --- UI Components (following laporan-sesi pattern) ---
const Section = ({ title, children, description, icon }) => (
  <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
    </div>
    {description && (
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
    )}
    <div className="space-y-4">{children}</div>
  </div>
);

const InputField = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    />
  </div>
);

const SelectField = ({
  label,
  name,
  value,
  onChange,
  children,
  required = true,
  disabled = false,
  id,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    >
      {children}
    </select>
  </div>
);

const TextArea = ({ label, name, value, onChange, placeholder, rows = 4, required = true }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const RadioGroup = ({ legend, name, options, value, onChange, required = true }) => (
  <fieldset>
    <legend className="block text-sm font-medium text-gray-700 mb-2">
      {legend}
      {required && <span className="text-red-500">*</span>}
    </legend>
    <div className="space-y-3">
      {options.map(opt => (
        <div key={opt.value} className="flex items-start">
          <input
            id={`${name}-${opt.value}`}
            name={name}
            type="radio"
            value={opt.value}
            checked={value === opt.value}
            onChange={onChange}
            required={required}
            className="h-4 w-4 mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={`${name}-${opt.value}`} className="ml-3 text-sm text-gray-700">
            {opt.label}
          </label>
        </div>
      ))}
    </div>
  </fieldset>
);

const CheckboxGroup = ({ legend, namePrefix, options, value, onChange, required = false }) => (
  <fieldset>
    <legend className="block text-sm font-medium text-gray-700 mb-2">
      {legend}
      {required && <span className="text-red-500">*</span>}
    </legend>
    <div className="space-y-3">
      {options.map(opt => (
        <div key={opt.value} className="flex items-start">
          <input
            id={`${namePrefix}-${opt.value}`}
            name={namePrefix}
            type="checkbox"
            value={opt.value}
            checked={value.includes(opt.value)}
            onChange={onChange}
            className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={`${namePrefix}-${opt.value}`} className="ml-3 text-sm text-gray-700">
            {opt.label}
          </label>
        </div>
      ))}
    </div>
  </fieldset>
);

const InfoCard = ({ companyName, address, phone }) => (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg text-sm">
    <h3 className="text-base font-bold text-gray-800 mb-2">Maklumat Usahawan</h3>
    <p><strong>Syarikat:</strong> {companyName || 'N/A'}</p>
    <p><strong>Alamat:</strong> {address || 'N/A'}</p>
    <p><strong>No. Tel:</strong> {phone || 'N/A'}</p>
  </div>
);

export default function UpwardMobilityPage() {
  const { data: session, status } = useSession();

  // --- State Management (following laporan-sesi pattern) ---
  const [allMentees, setAllMentees] = useState([]);
  const [uniqueMentors, setUniqueMentors] = useState([]);
  const [filteredMentees, setFilteredMentees] = useState([]);
  
  const [selectedAdminMentor, setSelectedAdminMentor] = useState('');
  const [selectedMentee, setSelectedMentee] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if user is admin
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
      const authorized = adminEmails.includes(session.user.email);
      setIsAuthorized(authorized);
      setAuthChecking(false);
    } else if (status === 'unauthenticated') {
      setAuthChecking(false);
    }
  }, [status, session]);

  const isAdmin = isAuthorized;
  // Initial form state
  const initialFormState = {
    email: session?.user?.email || '',
    program: 'iTEKAD BangKIT',
    sesiMentoring: 'Sesi 2',
    jenisPerniagaan: '',
    statusPenglibatan: '',
    upwardMobilityStatus: '',
    kriteriaImprovement: '',
    tarikhLawatan: '',
    penggunaanAkaunSemasa: '',
    penggunaanBimbBiz: '',
    bukaAkaunAlAwfar: '',
    penggunaanBimbMerchant: '',
    lainLainFasiliti: '',
    langganMesinKira: '',
    pendapatanSebelum: '',
    pendapatanSelepas: '',
    ulasanPendapatan: '',
    pekerjaanSebelum: '',
    pekerjaanSelepas: '',
    ulasanPekerjaan: '',
    asetBukanTunaiSebelum: '',
    asetBukanTunaiSelepas: '',
    asetTunaiSebelum: '',
    asetTunaiSelepas: '',
    ulasanAset: '',
    simpananSebelum: '',
    simpananSelepas: '',
    ulasanSimpanan: '',
    zakatSebelum: '',
    zakatSelepas: '',
    ulasanZakat: '',
    digitalSebelum: [],
    digitalSelepas: [],
    ulasanDigital: '',
    onlineSalesSebelum: [],
    onlineSalesSelepas: [],
    ulasanOnlineSales: '',
  };

  const [formState, setFormState] = useState(initialFormState);

  // Reset form function
  const resetForm = () => {
    setFormState(initialFormState);
    setSelectedMentee(null);
    setSelectedAdminMentor('');
    setFilteredMentees([]);
    
    // Reset selectors
    const menteeSelector = document.getElementById('mentee-selector');
    if (menteeSelector) menteeSelector.value = '';
    if (isAdmin) {
      const mentorSelector = document.getElementById('mentor-selector');
      if (mentorSelector) mentorSelector.value = '';
    }
  };

  // --- Data Fetching (following laporan-sesi pattern) ---
// Replace your useEffect with this enhanced version:

useEffect(() => {
  const fetchInitialData = async () => {
    if (status === 'authenticated') {
      setIsLoading(true);
      try {
        console.log('🔍 Fetching mapping data...');
        // Fetch data from both programs
        const [bangkitRes, majuRes] = await Promise.all([
          fetch('/api/mapping?programType=bangkit'),
          fetch('/api/mapping?programType=maju')
        ]);

        console.log('📊 Bangkit response status:', bangkitRes.status);
        console.log('📊 Maju response status:', majuRes.status);

        const [bangkitData, majuData] = await Promise.all([
          bangkitRes.json(),
          majuRes.json()
        ]);

        console.log('✅ Bangkit mentees:', bangkitData.length);
        console.log('✅ Maju mentees:', majuData.length);

        // Combine both datasets
        const mappingData = [...bangkitData, ...majuData];
        console.log('📦 Total combined mentees:', mappingData.length);

        if (bangkitRes.ok && majuRes.ok) {
          setAllMentees(mappingData);
          if (isAdmin) {
            console.log('👤 User is ADMIN');
            const mentors = [...new Set(mappingData.map((m) => m.Mentor))];
            console.log('👥 Unique mentors:', mentors.length);
            setUniqueMentors(mentors);
            setFilteredMentees([]);
          } else {
            console.log('👤 User is MENTOR:', session.user.email);
            const filtered = mappingData.filter((m) => m.Mentor_Email === session.user.email);
            console.log('✅ Filtered mentees for this mentor:', filtered.length);
            console.log('📋 Mentees:', filtered.map(m => m.Usahawan));
            setFilteredMentees(filtered);
          }
        } else {
          setError('Gagal memuatkan data usahawan.');
        }
      } catch (err) {
        console.error('❌ Error fetching data:', err);
        setError('Gagal memuatkan data awal.');
      } finally {
        setIsLoading(false);
      }
    }
  };
  fetchInitialData();
}, [status, session?.user?.email, isAdmin]);

  // --- Handler Functions (following laporan-sesi pattern) ---
  const handleAdminMentorChange = (mentorName) => {
    setSelectedAdminMentor(mentorName);
    setFilteredMentees(allMentees.filter((m) => m.Mentor === mentorName));
    setSelectedMentee(null);
  };

  const handleMenteeChange = (menteeName) => {
    if (!menteeName) {
      setSelectedMentee(null);
      return;
    }
    const menteeData = allMentees.find((m) => m.Usahawan  === menteeName);
    setSelectedMentee(menteeData);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormState(prev => ({
        ...prev,
        [name]: checked 
          ? [...(prev[name] || []), value]
          : (prev[name] || []).filter(item => item !== value)
      }));
    } else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedMentee) {
      setError('Sila pilih usahawan terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const fullFormData = {
        ...formState,
        namaMentor: session.user.name,
        namaUsahawan: selectedMentee.Usahawan,
        namaPerniagaan: selectedMentee.Nama_Syarikat,
        alamatPerniagaan: selectedMentee.Alamat,
        nomborTelefon: selectedMentee.No_Tel,
        batch: selectedMentee.Batch || 'Unknown',
      };

      const response = await fetch('/api/submit-upward-mobility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullFormData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghantar laporan.');
      }

      setSuccess('Laporan berjaya dihantar! Borang akan direset.');
      window.scrollTo(0, 0);
      
      setTimeout(() => {
        resetForm();
        setSuccess('');
      }, 3000);
      
    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || isLoading || authChecking) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="text-center">Memuatkan...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Sila log masuk untuk mengakses borang ini.</p>
        </div>
      </div>
    );
  }

  // Admin access check
  if (!isAuthorized) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            Borang ini hanya untuk kegunaan admin sahaja.
         /* Admin Warning Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-yellow-800">Admin Tool - Untuk Kes Khas Sahaja</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Borang ini untuk kegunaan manual jika mentor tidak dapat submit laporan.
                Mentor regular sila gunakan borang gabungan laporan.
              </p>
            </div>
          </div>
        </div>

        { </p>
          <p className="text-sm text-gray-500 mb-6">
            Sila gunakan borang gabungan laporan untuk submit sesi mentoring.
          </p>
          <button
            onClick={() => window.location.href = '/mentor/dashboard'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <header className="text-center bg-white p-6 rounded-lg shadow-sm">
          <img src="/logo1.png" alt="iTEKAD Logos" className="mx-auto h-20 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Borang Upward Mobility</h1>
          <p className="text-gray-500 mt-1">Laporan Sesi iTEKAD BangKIT (Diisi oleh Mentor)</p>
        </header>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
            <p className="font-bold">Ralat</p>
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
            <p className="font-bold">Berjaya</p>
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
<Section title="1. Pemilihan Usahawan" icon={<UserIcon />}>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <InputField
      label="Nama Mentor"
      value={session?.user?.name || ''}
      disabled
    />

    {isAdmin && (
      <SelectField
        id="mentor-selector"
        label="Pilih Mentor (Admin Only)"
        name="adminMentor"
        value={selectedAdminMentor}
        onChange={(e) => handleAdminMentorChange(e.target.value)}
        required={false}
      >
        <option value="">-- Sila Pilih Mentor --</option>
        {uniqueMentors.map((mentor) => (
          <option key={mentor} value={mentor}>
            {mentor}
          </option>
        ))}
      </SelectField>
    )}
  </div>

  <div className="grid grid-cols-1 gap-6 mt-4">
    <SelectField
      id="mentee-selector"
      label="Pilih Usahawan (Mentee)"
      name="mentee"
      value={selectedMentee?.Usahawan || ''}
      onChange={(e) => handleMenteeChange(e.target.value)}
      required
      disabled={isAdmin && !selectedAdminMentor}
    >
      <option value="">-- Sila Pilih Usahawan --</option>
      {filteredMentees.map((mentee) => (
        <option key={mentee.Usahawan} value={mentee.Usahawan}>
          {mentee.Usahawan}
        </option>
      ))}
    </SelectField>
  </div>

  {selectedMentee && (
    <div className="mt-4">
      <InfoCard 
        companyName={selectedMentee.Nama_Syarikat}
        address={selectedMentee.Alamat}
        phone={selectedMentee.No_Tel}
      />
    </div>
  )}
</Section>

          {selectedMentee && (
            <>
              <Section title="2. Butiran Laporan" icon={<BriefcaseIcon />}>
                <InputField
                  label="Email Address (Mentor)"
                  name="email"
                  type="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  required
                />
                <InputField
                  label="Jenis Perniagaan dan Produk/Servis"
                  name="jenisPerniagaan"
                  value={formState.jenisPerniagaan}
                  onChange={handleInputChange}
                  placeholder="Contoh: Jahitan - kain langsir"
                  required
                />
                <RadioGroup
                  legend="Sesi Mentoring"
                  name="sesiMentoring"
                  value={formState.sesiMentoring}
                  onChange={handleInputChange}
                  options={[
                    {value: 'Sesi 2', label: 'Sesi 2'},
                    {value: 'Sesi 4', label: 'Sesi 4'}
                  ]}
                />
              </Section>

              <Section title="3. Status & Mobiliti" icon={<TrendingUpIcon />}>
                <RadioGroup
                  legend="Status Penglibatan Usahawan"
                  name="statusPenglibatan"
                  value={formState.statusPenglibatan}
                  onChange={handleInputChange}
                  options={[
                    {value: 'Active', label: 'Active - masih aktif dengan bisnes dan sesi mentoring'},
                    {value: 'Not Active (Contactable)', label: 'Not Active (Contactable) - tidak aktif tetapi masih respon'},
                    {value: 'Not Involved (Uncontactable)', label: 'Not Involved (Uncontactable) - tiada respon'}
                  ]}
                />
                <RadioGroup
                  legend="Upward Mobility Status"
                  name="upwardMobilityStatus"
                  value={formState.upwardMobilityStatus}
                  onChange={handleInputChange}
                  options={[
                    {value: 'G1', label: 'Grade 1 (G1) - Lulus kemudahan/fasiliti SME'},
                    {value: 'G2', label: 'Grade 2 (G2) - Berjaya improve credit worthiness'},
                    {value: 'G3', label: 'Grade 3 (G3) - Improve mana-mana bahagian bisnes'},
                    {value: 'NIL', label: 'NIL - Tiada peningkatan'}
                  ]}
                />
                <TextArea
                  label="Jika G1/G2/G3, nyatakan kriteria improvement"
                  name="kriteriaImprovement"
                  value={formState.kriteriaImprovement}
                  onChange={handleInputChange}
                  placeholder="Contoh: Grade 1 (SME facility from BIMB - property financing)"
                  required={false}
                />
                <InputField
                  label="Tarikh lawatan ke premis (Jika belum, tulis 0)"
                  name="tarikhLawatan"
                  value={formState.tarikhLawatan}
                  onChange={handleInputChange}
                  required
                />
              </Section>

              <Section title="4. Penggunaan Saluran Bank Islam & Fintech" icon={<BankIcon />}>
                <RadioGroup legend="1. Penggunaan Akaun Semasa BIMB" name="penggunaanAkaunSemasa" value={formState.penggunaanAkaunSemasa} onChange={handleInputChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                <RadioGroup legend="2. Penggunaan BIMB Biz" name="penggunaanBimbBiz" value={formState.penggunaanBimbBiz} onChange={handleInputChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                <RadioGroup legend="3. Buka akaun Al-Awfar" name="bukaAkaunAlAwfar" value={formState.bukaAkaunAlAwfar} onChange={handleInputChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                <RadioGroup legend="4. Penggunaan BIMB Merchant Terminal/Pay2phone" name="penggunaanBimbMerchant" value={formState.penggunaanBimbMerchant} onChange={handleInputChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                <RadioGroup legend="5. Lain-lain Fasiliti BIMB" name="lainLainFasiliti" value={formState.lainLainFasiliti} onChange={handleInputChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                <RadioGroup legend="6. Melanggan aplikasi MesinKira" name="langganMesinKira" value={formState.langganMesinKira} onChange={handleInputChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
              </Section>

              <Section title="5. Situasi Kewangan Perniagaan (Sebelum & Selepas)" icon={<DollarSignIcon />}>
                <div className="grid md:grid-cols-2 gap-6">
                  <InputField label="Jumlah Pendapatan (Sebelum)" name="pendapatanSebelum" type="number" value={formState.pendapatanSebelum} onChange={handleInputChange} placeholder="RM" required />
                  <InputField label="Jumlah Pendapatan (Selepas)" name="pendapatanSelepas" type="number" value={formState.pendapatanSelepas} onChange={handleInputChange} placeholder="RM" required />
                </div>
                <TextArea label="Ulasan Mentor (Jumlah Pendapatan)" name="ulasanPendapatan" value={formState.ulasanPendapatan} onChange={handleInputChange} required />
                
                <div className="grid md:grid-cols-2 gap-6">
                  <InputField label="Peluang Pekerjaan (Sebelum)" name="pekerjaanSebelum" type="number" value={formState.pekerjaanSebelum} onChange={handleInputChange} placeholder="Bilangan pekerja" required />
                  <InputField label="Peluang Pekerjaan (Selepas)" name="pekerjaanSelepas" type="number" value={formState.pekerjaanSelepas} onChange={handleInputChange} placeholder="Bilangan pekerja" required />
                </div>
                <TextArea label="Ulasan Mentor (Peluang Pekerjaan)" name="ulasanPekerjaan" value={formState.ulasanPekerjaan} onChange={handleInputChange} required />

                <div className="grid md:grid-cols-2 gap-6">
                  <InputField label="Nilai Aset Bukan Tunai (Sebelum)" name="asetBukanTunaiSebelum" type="number" value={formState.asetBukanTunaiSebelum} onChange={handleInputChange} placeholder="RM" required />
                  <InputField label="Nilai Aset Bukan Tunai (Selepas)" name="asetBukanTunaiSelepas" type="number" value={formState.asetBukanTunaiSelepas} onChange={handleInputChange} placeholder="RM" required />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <InputField label="Nilai Aset Bentuk Tunai (Sebelum)" name="asetTunaiSebelum" type="number" value={formState.asetTunaiSebelum} onChange={handleInputChange} placeholder="RM" required />
                  <InputField label="Nilai Aset Bentuk Tunai (Selepas)" name="asetTunaiSelepas" type="number" value={formState.asetTunaiSelepas} onChange={handleInputChange} placeholder="RM" required />
                </div>
                <TextArea label="Ulasan Mentor (Nilai Aset)" name="ulasanAset" value={formState.ulasanAset} onChange={handleInputChange} required />

                <div className="grid md:grid-cols-2 gap-6">
                  <InputField label="Simpanan Perniagaan (Sebelum)" name="simpananSebelum" type="number" value={formState.simpananSebelum} onChange={handleInputChange} placeholder="RM" required />
                  <InputField label="Simpanan Perniagaan (Selepas)" name="simpananSelepas" type="number" value={formState.simpananSelepas} onChange={handleInputChange} placeholder="RM" required />
                </div>
                <TextArea label="Ulasan Mentor (Simpanan)" name="ulasanSimpanan" value={formState.ulasanSimpanan} onChange={handleInputChange} required />
                
                <div className="grid md:grid-cols-2 gap-6">
                  <InputField label="Pembayaran Zakat Perniagaan (Sebelum)" name="zakatSebelum" type="number" value={formState.zakatSebelum} onChange={handleInputChange} placeholder="RM" required />
                  <InputField label="Pembayaran Zakat Perniagaan (Selepas)" name="zakatSelepas" type="number" value={formState.zakatSelepas} onChange={handleInputChange} placeholder="RM" required />
                </div>
                <TextArea label="Ulasan Mentor (Pembayaran Zakat)" name="ulasanZakat" value={formState.ulasanZakat} onChange={handleInputChange} required />
              </Section>

              <Section title="6. Digitalisasi & Pemasaran Online" icon={<LaptopIcon />}>
                <div className="grid md:grid-cols-2 gap-8">
                  <CheckboxGroup
                    legend="Penggunaan Digital (Sebelum)"
                    namePrefix="digitalSebelum"
                    value={formState.digitalSebelum}
                    onChange={handleInputChange}
                    options={[
                      {value: 'Data asas dan terhad', label: 'Data asas dan terhad'},
                      {value: 'Pengguna advance', label: 'Pengguna advance'},
                      {value: 'Transaksi kewangan', label: 'Transaksi kewangan (e-wallet)'},
                      {value: 'Laman web rasmi', label: 'Laman web rasmi'}
                    ]}
                  />
                  <CheckboxGroup
                    legend="Penggunaan Digital (Selepas)"
                    namePrefix="digitalSelepas"
                    value={formState.digitalSelepas}
                    onChange={handleInputChange}
                    options={[
                      {value: 'Data asas dan terhad', label: 'Data asas dan terhad'},
                      {value: 'Pengguna advance', label: 'Pengguna advance'},
                      {value: 'Transaksi kewangan', label: 'Transaksi kewangan (e-wallet)'},
                      {value: 'Laman web rasmi', label: 'Laman web rasmi'}
                    ]}
                  />
                </div>
                <TextArea label="Ulasan Mentor (Penggunaan Digital)" name="ulasanDigital" value={formState.ulasanDigital} onChange={handleInputChange} required />
                
                <div className="grid md:grid-cols-2 gap-8">
                  <CheckboxGroup
                    legend="Jualan & Pemasaran Online (Sebelum)"
                    namePrefix="onlineSalesSebelum"
                    value={formState.onlineSalesSebelum}
                    onChange={handleInputChange}
                    options={[
                      {value: 'Jualan Bisnes secara Online', label: 'Jualan Bisnes secara Online (e-commerce)'},
                      {value: 'Pemasaran secara Online dan Live', label: 'Pemasaran secara Online dan Live (Ads, Live)'},
                      {value: 'Perniagaan campuran', label: 'Perniagaan campuran (Online & Premis)'},
                      {value: 'Premis / Kedai fizikal', label: 'Premis / Kedai fizikal'}
                    ]}
                  />
                  <CheckboxGroup
                    legend="Jualan & Pemasaran Online (Selepas)"
                    namePrefix="onlineSalesSelepas"
                    value={formState.onlineSalesSelepas}
                    onChange={handleInputChange}
                    options={[
                      {value: 'Jualan Bisnes secara Online', label: 'Jualan Bisnes secara Online (e-commerce)'},
                      {value: 'Pemasaran secara Online dan Live', label: 'Pemasaran secara Online dan Live (Ads, Live)'},
                      {value: 'Perniagaan campuran', label: 'Perniagaan campuran (Online & Premis)'},
                      {value: 'Premis / Kedai fizikal', label: 'Premis / Kedai fizikal'}
                    ]}
                  />
                </div>
                <TextArea label="Ulasan Mentor (Jualan dan Pemasaran)" name="ulasanOnlineSales" value={formState.ulasanOnlineSales} onChange={handleInputChange} required />
              </Section>

              <div className="mt-6 pt-6 border-t text-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full md:w-auto bg-green-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Menghantar...' : 'Hantar Laporan'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}