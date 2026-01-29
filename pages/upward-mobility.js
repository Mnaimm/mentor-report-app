// pages/upward-mobility.js
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  UPWARD_MOBILITY_SECTIONS,
  INITIAL_UPWARD_MOBILITY_STATE,
  calculateCheckboxValue,
  calculateTagClickValue,
  validateUpwardMobility
} from '../lib/upwardMobilityUtils';

// --- Icon Components ---
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const BriefcaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;
const TrendingUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
const BankIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="m3 21 18-0" /><path d="M5 21V10l7-5 7 5v11" /><path d="M12 21V10" /><path d="m10 15-1.5-1.5" /><path d="m14 15 1.5-1.5" /><path d="m10 12 2 2 2-2" /></svg>;
const DollarSignIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const LaptopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55A1 1 0 0 1 20.28 20H3.72a1 1 0 0 1-.99-1.45L4 16Z"></path></svg>;

// --- Helper Components ---
const Section = ({ title, children, description, icon }) => (
  <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm mb-6">
    <div className="flex items-center gap-3 mb-4">
      {icon}
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
    </div>
    {description && (
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
    )}
    <div className="space-y-6">{children}</div>
  </div>
);

const InputField = ({ label, type = 'text', name, value, onChange, placeholder, required = false, disabled = false }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
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

const SelectField = ({ label, name, value, onChange, children, required = true, disabled = false, id }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
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

const TextArea = ({ label, name, value, onChange, placeholder, rows = 4, required = true, helperText }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {helperText && (
      <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-gray-700 whitespace-pre-line">
        {helperText}
      </div>
    )}
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
      {legend} {required && <span className="text-red-500">*</span>}
    </legend>
    <div className="space-y-2">
      {options.map(opt => (
        <div key={opt.value} className="flex items-center">
          <input
            id={`${name}-${opt.value}`}
            name={name}
            type="radio"
            value={opt.value}
            checked={value === opt.value}
            onChange={onChange}
            required={required}
            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={`${name}-${opt.value}`} className="ml-3 text-sm text-gray-700">
            {opt.label}
          </label>
        </div>
      ))}
    </div>
  </fieldset>
);

const InfoCard = ({ companyName, address, phone }) => (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg text-sm mt-4">
    <h3 className="text-base font-bold text-gray-800 mb-2">Maklumat Usahawan</h3>
    <p><strong>Syarikat:</strong> {companyName || 'N/A'}</p>
    <p><strong>Alamat:</strong> {address || 'N/A'}</p>
    <p><strong>No. Tel:</strong> {phone || 'N/A'}</p>
  </div>
);

// --- Main Page Component ---
export default function UpwardMobilityPage() {
  const { data: session, status } = useSession();

  // --- State ---
  const [allMentees, setAllMentees] = useState([]);
  const [uniqueMentors, setUniqueMentors] = useState([]);
  const [filteredMentees, setFilteredMentees] = useState([]);

  const [selectedAdminMentor, setSelectedAdminMentor] = useState('');
  const [selectedMentee, setSelectedMentee] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Admin check
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Form State
  const [basicInfo, setBasicInfo] = useState({
    email: '',
    program: 'iTEKAD BangKIT',
    sesiMentoring: 'Sesi 1', // Default
    jenisPerniagaan: '',
    statusPenglibatan: '',
    tarikhLawatan: ''
  });

  const [umState, setUmState] = useState(INITIAL_UPWARD_MOBILITY_STATE);

  // --- Effects ---
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
      const authorized = adminEmails.includes(session.user.email);
      setIsAuthorized(authorized);
      setAuthChecking(false);
      setBasicInfo(prev => ({ ...prev, email: session.user.email }));
    } else if (status === 'unauthenticated') {
      setAuthChecking(false);
    }
  }, [status, session]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        try {
          const [bangkitRes, majuRes] = await Promise.all([
            fetch('/api/mapping?programType=bangkit'),
            fetch('/api/mapping?programType=maju')
          ]);

          const [bangkitData, majuData] = await Promise.all([
            bangkitRes.json(),
            majuRes.json()
          ]);

          const mappingData = [...bangkitData, ...majuData];

          if (bangkitRes.ok && majuRes.ok) {
            setAllMentees(mappingData);
            if (isAuthorized) {
              const mentors = [...new Set(mappingData.map((m) => m.Mentor))];
              setUniqueMentors(mentors);
              setFilteredMentees([]);
            } else {
              const filtered = mappingData.filter((m) => m.Mentor_Email === session.user.email);
              setFilteredMentees(filtered);
            }
          } else {
            setError('Gagal memuatkan data usahawan.');
          }
        } catch (err) {
          console.error('Error fetching data:', err);
          setError('Gagal memuatkan data awal.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    if (!authChecking) fetchInitialData();
  }, [status, isAuthorized, authChecking, session?.user?.email]);

  const isAdmin = isAuthorized;

  // --- Handlers ---
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
    const menteeData = allMentees.find((m) => m.Usahawan === menteeName);
    setSelectedMentee(menteeData);
  };

  const handleBasicInfoChange = (e) => {
    const { name, value } = e.target;
    setBasicInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSessionChange = (sessionValue) => {
    setBasicInfo(prev => ({ ...prev, sesiMentoring: sessionValue }));
  };

  // Upward Mobility Utils Handlers
  const handleUMChange = (field, value) => {
    setUmState(prev => ({ ...prev, [field]: value }));
  };

  const handleUMCheckboxChange = (field, value, checked) => {
    setUmState(prev => {
      const currentArray = prev[field] || [];
      const updatedArray = calculateCheckboxValue(currentArray, value, checked);
      return { ...prev, [field]: updatedArray };
    });
  };

  const handleTagClick = (tag) => {
    const currentValue = umState.UM_KRITERIA_IMPROVEMENT || '';
    const newValue = calculateTagClickValue(currentValue, tag);
    if (newValue !== currentValue) {
      handleUMChange('UM_KRITERIA_IMPROVEMENT', newValue);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMentee) {
      setError('Sila pilih usahawan terlebih dahulu.');
      return;
    }

    // Validate Upward Mobility State
    const umErrors = validateUpwardMobility(umState, false); // isMIA = false
    if (umErrors.length > 0) {
      setError(`Sila lengkapkan medan berikut:\n${umErrors.join('\n')}`);
      window.scrollTo(0, 0);
      return;
    }

    if (!basicInfo.jenisPerniagaan) {
      setError('Sila isi Jenis Perniagaan.');
      window.scrollTo(0, 0);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const fullPayload = {
        ...basicInfo,
        // Mentor & Mentee Info
        namaMentor: session.user.name,
        namaUsahawan: selectedMentee.Usahawan,
        namaPerniagaan: selectedMentee.Nama_Syarikat,
        alamatPerniagaan: selectedMentee.Alamat,
        nomborTelefon: selectedMentee.No_Tel,
        batch: selectedMentee.Batch || 'Unknown',
        emailUsahawan: selectedMentee.Email || selectedMentee.MENTEE_EMAIL_FROM_MAPPING || '',

        // Upward Mobility Data (JSON string for backend processing)
        UPWARD_MOBILITY_JSON: JSON.stringify(umState)
      };

      const response = await fetch('/api/submit-upward-mobility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghantar laporan.');
      }

      setSuccess('Laporan berjaya dihantar! Terima kasih.');
      window.scrollTo(0, 0);

      // Reset form after delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Rendering ---
  if (status === 'loading' || isLoading || authChecking) {
    return <div className="text-center p-10">Memuatkan...</div>;
  }

  if (status === 'unauthenticated') {
    return <div className="text-center p-10">Sila log masuk.</div>;
  }

  if (!isAuthorized) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">Borang ini hanya untuk kegunaan admin/mentor berdaftar.</p>
          <button onClick={() => window.location.href = '/'} className="bg-blue-600 text-white px-4 py-2 rounded">Kembali</button>
        </div>
      </div>
    );
  }

  // Helper to render Section 4 (Bank & Fintech)
  const renderSection4 = () => {
    const section = UPWARD_MOBILITY_SECTIONS.SECTION_4;
    return (
      <Section title={section.title} icon={<BankIcon />}>
        {section.items.map(item => (
          <RadioGroup
            key={item.id}
            legend={
              <div>
                <span className="font-semibold">{item.title}</span>
                <p className="text-xs font-normal text-gray-500 mt-1 whitespace-pre-line">{item.desc}</p>
              </div>
            }
            name={item.id}
            value={umState[item.id]}
            onChange={(e) => handleUMChange(item.id, e.target.value)}
            options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
            required
          />
        ))}
      </Section>
    );
  };

  // Helper to render Section 5 (Financial)
  const renderSection5 = () => {
    const section = UPWARD_MOBILITY_SECTIONS.SECTION_5;
    return (
      <Section title={section.title} description={section.infoMessage} icon={<DollarSignIcon />}>
        {section.items.map((item, idx) => {
          if (item.type === 'radio_yes_no') {
            return (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <RadioGroup
                  legend={item.label}
                  name={item.field}
                  value={umState[item.field]}
                  onChange={(e) => handleUMChange(item.field, e.target.value)}
                  options={[{ value: 'Yes', label: 'Ya' }, { value: 'No', label: 'Tidak' }]}
                  required
                />
                <div className="mt-3">
                  <TextArea
                    label={item.ulasanLabel}
                    name={item.ulasanField}
                    value={umState[item.ulasanField]}
                    onChange={(e) => handleUMChange(item.ulasanField, e.target.value)}
                    placeholder={item.ulasanPlaceholder}
                    required
                  />
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100 grid md:grid-cols-2 gap-4">
              <InputField
                label={item.label}
                name={item.field}
                type="number"
                value={umState[item.field]}
                onChange={(e) => handleUMChange(item.field, e.target.value)}
                placeholder={item.placeholder}
                required
              />
              <TextArea
                label={item.ulasanLabel}
                name={item.ulasanField}
                value={umState[item.ulasanField]}
                onChange={(e) => handleUMChange(item.ulasanField, e.target.value)}
                placeholder={item.ulasanPlaceholder}
                required
              />
            </div>
          );
        })}
      </Section>
    );
  };

  // Helper to render Section 6 (Digital)
  const renderSection6 = () => {
    const section = UPWARD_MOBILITY_SECTIONS.SECTION_6;
    return (
      <Section title={section.title} icon={<LaptopIcon />}>
        {/* Digital Usage */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">{section.digital.label} <span className="text-red-500">*</span></label>
          <div className="space-y-2 mb-3">
            {section.digital.options.map((opt, i) => {
              // Extract value and label from the string format in utils
              // Example: "1 - Data asas..." -> value="Data asas...", label="Data asas..."
              // Or simpler: just use the whole string as value, but that might update state weirdly if we want clean values.
              // For simplicity, let's assume the value stored is the full string to match Utils logic.
              return (
                <div key={i} className="flex items-start">
                  <input
                    type="checkbox"
                    checked={(umState.UM_DIGITAL_SEMASA || []).includes(opt)}
                    onChange={(e) => handleUMCheckboxChange('UM_DIGITAL_SEMASA', opt, e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{opt}</span>
                </div>
              );
            })}
          </div>
          <TextArea
            label={section.digital.ulasanLabel}
            name={section.digital.ulasanField}
            value={umState[section.digital.ulasanField]}
            onChange={(e) => handleUMChange(section.digital.ulasanField, e.target.value)}
            placeholder={section.digital.ulasanPlaceholder}
            required
          />
        </div>

        {/* Marketing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{section.marketing.label} <span className="text-red-500">*</span></label>
          <div className="space-y-2 mb-3">
            {section.marketing.options.map((opt, i) => (
              <div key={i} className="flex items-start">
                <input
                  type="checkbox"
                  checked={(umState.UM_MARKETING_SEMASA || []).includes(opt)}
                  onChange={(e) => handleUMCheckboxChange('UM_MARKETING_SEMASA', opt, e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{opt}</span>
              </div>
            ))}
          </div>
          <TextArea
            label={section.marketing.ulasanLabel}
            name={section.marketing.ulasanField}
            value={umState[section.marketing.ulasanField]}
            onChange={(e) => handleUMChange(section.marketing.ulasanField, e.target.value)}
            placeholder={section.marketing.ulasanPlaceholder}
            required
          />
        </div>
      </Section>
    );
  };


  return (
    <div className="bg-gray-100 min-h-screen font-sans py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center bg-white p-6 rounded-lg shadow-sm mb-6">
          <img src="/logo1.png" alt="iTEKAD Logos" className="mx-auto h-20 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Borang Upward Mobility</h1>
          <p className="text-gray-500 mt-1">Laporan Kemajuan Usahawan (Standalone)</p>
        </header>

        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"><p className="font-bold">Ralat</p><p className="whitespace-pre-line">{error}</p></div>}
        {success && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6"><p className="font-bold">Berjaya</p><p>{success}</p></div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Pemilihan Usahawan */}
          <Section title="1. Pemilihan Usahawan" icon={<UserIcon />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField label="Nama Mentor" value={session?.user?.name || ''} disabled />
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
                  {uniqueMentors.map(m => <option key={m} value={m}>{m}</option>)}
                </SelectField>
              )}
            </div>
            <div className="mt-4">
              <SelectField
                id="mentee-selector"
                label="Pilih Usahawan (Mentee)"
                name="mentee"
                value={selectedMentee?.Usahawan || ''}
                onChange={(e) => handleMenteeChange(e.target.value)}
                required
              >
                <option value="">-- Sila Pilih Usahawan --</option>
                {filteredMentees.map(m => <option key={m.Usahawan} value={m.Usahawan}>{m.Usahawan}</option>)}
              </SelectField>
              {selectedMentee && <InfoCard companyName={selectedMentee.Nama_Syarikat} address={selectedMentee.Alamat} phone={selectedMentee.No_Tel} />}
            </div>
          </Section>

          {selectedMentee && (
            <>
              {/* Section 2: Butiran Laporan */}
              <Section title="2. Butiran Laporan" icon={<BriefcaseIcon />}>
                <InputField label="Email Address (Mentor)" name="email" value={basicInfo.email} onChange={handleBasicInfoChange} required />
                <InputField label="Jenis Perniagaan dan Produk/Servis" name="jenisPerniagaan" value={basicInfo.jenisPerniagaan} onChange={handleBasicInfoChange} placeholder="Contoh: Jahitan - kain langsir" required />

                {/* Sesi Mentoring Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sesi Mentoring <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {['Sesi 1', 'Sesi 2', 'Sesi 3', 'Sesi 4'].map((sesi) => (
                      <button
                        key={sesi}
                        type="button"
                        onClick={() => handleSessionChange(sesi)}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                          ${basicInfo.sesiMentoring === sesi
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {sesi}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Section 3: Status & Mobiliti */}
              <Section title="3. Status & Mobiliti" icon={<TrendingUpIcon />}>
                <RadioGroup
                  legend="Status Penglibatan Usahawan"
                  name="statusPenglibatan"
                  value={basicInfo.statusPenglibatan}
                  onChange={handleBasicInfoChange}
                  options={[
                    { value: 'Active', label: 'Active - masih aktif dengan bisnes dan sesi mentoring' },
                    { value: 'Not Active (Contactable)', label: 'Not Active (Contactable) - tidak aktif tetapi masih respon' },
                    { value: 'Not Involved (Uncontactable)', label: 'Not Involved (Uncontactable) - tiada respon' }
                  ]}
                />
                <RadioGroup
                  legend="Upward Mobility Status"
                  name="UM_STATUS"
                  value={umState.UM_STATUS}
                  onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                  options={[
                    { value: 'G1', label: 'Grade 1 (G1) - Lulus kemudahan/fasiliti SME' },
                    { value: 'G2', label: 'Grade 2 (G2) - Berjaya improve credit worthiness' },
                    { value: 'G3', label: 'Grade 3 (G3) - Improve mana-mana bahagian bisnes' },
                    { value: 'NIL', label: 'NIL - Tiada peningkatan' }
                  ]}
                />

                {/* Kriteria Improvement Tags */}
                {umState.UM_STATUS && ['G1', 'G2', 'G3'].includes(umState.UM_STATUS) && (
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-100 mb-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Quick Tags:</span>
                    <div className="flex flex-wrap gap-2">
                      {/* Only show tags relevant to selected grade, or show all? Utils has a map. */}
                      {/* Simplified for now: show all or filter if we imported the map properly */}
                      {['Income/Sale', 'Job Creation', 'Asset', 'Saving', 'Zakat', 'Digitalization', 'Online Sales', 'BIMB SME Facility'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagClick(tag)}
                          className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <TextArea
                  label="Jika G1/G2/G3, nyatakan kriteria improvement"
                  name="UM_KRITERIA_IMPROVEMENT"
                  value={umState.UM_KRITERIA_IMPROVEMENT}
                  onChange={(e) => handleUMChange('UM_KRITERIA_IMPROVEMENT', e.target.value)}
                  placeholder="Contoh: Grade 1 (SME facility from BIMB - property financing)"
                  required={false}
                />

                <InputField
                  label="Tarikh lawatan ke premis (Jika belum, tulis 0)"
                  name="UM_TARIKH_LAWATAN_PREMIS"
                  value={umState.UM_TARIKH_LAWATAN_PREMIS}
                  onChange={(e) => handleUMChange('UM_TARIKH_LAWATAN_PREMIS', e.target.value)}
                  required
                />
              </Section>

              {/* Dynamic Sections from Utils */}
              {renderSection4()}
              {renderSection5()}
              {renderSection6()}

              {/* Submit Button */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg transform transition hover:scale-[1.01]"
                >
                  {isSubmitting ? 'Menghantar Data...' : 'Hantar Laporan Upward Mobility'}
                </button>
                <p className="text-center text-gray-500 mt-2 text-sm">Pastikan semua maklumat bertanda * telah diisi.</p>
              </div>

            </>
          )}

        </form>
      </div>
    </div>
  );
}