// pages/upward-mobility.js
import { useState, useEffect } from 'react';

// --- Icon Components ---
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const BriefcaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;
const TrendingUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
const BankIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="m3 21 18-0"/><path d="M5 21V10l7-5 7 5v11"/><path d="M12 21V10"/><path d="m10 15-1.5-1.5"/><path d="m14 15 1.5-1.5"/><path d="m10 12 2 2 2-2"/></svg>;
const DollarSignIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const LaptopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55A1 1 0 0 1 20.28 20H3.72a1 1 0 0 1-.99-1.45L4 16Z"></path></svg>;

// --- Reusable Helper Components ---
const FormSection = ({ icon, title, children }) => (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-gray-200/80 space-y-6">
        <div className="flex items-center gap-4">
            {icon}
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        </div>
        <div className="border-t border-gray-200 -mx-6 sm:-mx-8"></div>
        <div className="pt-2 space-y-8">{children}</div>
    </div>
);
const Input = ({ label, name, value, onChange, required = false, type = 'text', placeholder = '' }) => (
    <div>
        <label htmlFor={name} className="block text-base font-medium text-gray-700 mb-2">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
        <input type={type} name={name} id={name} value={value} onChange={onChange} required={required} placeholder={placeholder} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"/>
    </div>
);
const Textarea = ({ label, name, value, onChange, required = false, placeholder = '' }) => (
    <div>
        <label htmlFor={name} className="block text-base font-medium text-gray-700 mb-2">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
        <textarea name={name} id={name} value={value} onChange={onChange} required={required} placeholder={placeholder} rows="4" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"></textarea>
    </div>
);
const RadioGroup = ({ legend, name, options, value, onChange, required = true }) => (
    <fieldset>
        <legend className="text-base font-medium text-gray-900 mb-2">{legend}{required && <span className="text-red-500 ml-1">*</span>}</legend>
        <div className="space-y-4 pt-2">
            {options.map(opt => (
                <div key={opt.value} className="flex items-center">
                    <input id={`${name}-${opt.value}`} name={name} type="radio" value={opt.value} checked={value === opt.value} onChange={onChange} required={required} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor={`${name}-${opt.value}`} className="ml-3 block text-sm font-medium text-gray-700">{opt.label}</label>
                </div>
            ))}
        </div>
    </fieldset>
);
const CheckboxGroup = ({ legend, namePrefix, options, value, onChange, required = false }) => (
     <fieldset>
        <legend className="text-base font-medium text-gray-900 mb-2">{legend}{required && <span className="text-red-500 ml-1">*</span>}</legend>
        <div className="space-y-4 pt-2">
            {options.map(opt => (
                <div key={opt.value} className="relative flex items-start">
                    <div className="flex h-5 items-center">
                        <input id={`${namePrefix}-${opt.value}`} name={namePrefix} type="checkbox" value={opt.value} checked={value.includes(opt.value)} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor={`${namePrefix}-${opt.value}`} className="font-medium text-gray-700">{opt.label}</label>
                    </div>
                </div>
            ))}
        </div>
    </fieldset>
);


export default function UpwardMobilityPage() {
  // --- State Management ---
  const [mappingData, setMappingData] = useState([]);
  const [batches, setBatches] = useState([]);
  const [zones, setZones] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [mentees, setMentees] = useState([]);

  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedMentor, setSelectedMentor] = useState('');
  const [selectedMentee, setSelectedMentee] = useState('');
  const [menteeDetails, setMenteeDetails] = useState(null);
  
  const [formData, setFormData] = useState({
    email: '',
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
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // --- Data Fetching ---
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/get-mentee-mapping')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
            setMappingData(data);
            const uniqueBatches = [...new Set(data.map(item => item.batch))];
            setBatches(uniqueBatches);
        } else {
            setSubmitMessage("Error: Mapping data is not in expected format.");
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch mapping data", error);
        setSubmitMessage("Failed to load critical mapping data. Please refresh.");
        setIsLoading(false);
      });
  }, []);

  // --- Cascading Dropdown Logic ---
  const handleBatchChange = (e) => {
    const batch = e.target.value;
    setSelectedBatch(batch);
    setSelectedZone('');
    setSelectedMentor('');
    setSelectedMentee('');
    setMenteeDetails(null);
    const zonesInBatch = [...new Set(mappingData.filter(item => item.batch === batch).map(item => item.zon))];
    setZones(zonesInBatch);
  };

  const handleZoneChange = (e) => {
    const zone = e.target.value;
    setSelectedZone(zone);
    setSelectedMentor('');
    setSelectedMentee('');
    setMenteeDetails(null);
    const mentorsInZone = [...new Set(mappingData.filter(item => item.batch === selectedBatch && item.zon === zone).map(item => item.mentor))];
    setMentors(mentorsInZone);
  };

  const handleMentorChange = (e) => {
    const mentor = e.target.value;
    setSelectedMentor(mentor);
    setSelectedMentee('');
    setMenteeDetails(null);
    const menteesOfMentor = mappingData.filter(item => item.batch === selectedBatch && item.zon === selectedZone && item.mentor === mentor);
    setMentees(menteesOfMentor);
  };

  const handleMenteeChange = (e) => {
    const menteeName = e.target.value;
    setSelectedMentee(menteeName);
    setMenteeDetails(mappingData.find(item => item.mentee === menteeName) || null);
  };
  
  // --- Form Submission Logic ---
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
        const namePrefix = name;
        setFormData(prev => ({
            ...prev,
            [namePrefix]: checked 
                ? [...(prev[namePrefix] || []), value]
                : (prev[namePrefix] || []).filter(item => item !== value)
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');
    if (!selectedMentee || !menteeDetails) {
        alert("Sila pilih usahawan terlebih dahulu.");
        setIsSubmitting(false);
        return;
    }
    const fullFormData = {
        ...formData,
        batch: selectedBatch,
        namaMentor: selectedMentor,
        namaUsahawan: menteeDetails.mentee,
        namaPerniagaan: menteeDetails.namaSyarikat,
        alamatPerniagaan: menteeDetails.alamat,
        nomborTelefon: menteeDetails.noTelefon,
    };
    try {
      const response = await fetch('/api/submit-upward-mobility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullFormData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
      }
      const result = await response.json();
      setSubmitMessage("Form submitted successfully! Thank you.");
      window.scrollTo(0, document.body.scrollHeight);
    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitMessage(`Submission failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
        <div className="container mx-auto p-4 sm:p-8">
            <div className="max-w-5xl mx-auto">
                <header className="text-center mb-12">
                    <img src="/logo1.png" alt="Logo" className="mx-auto h-16 w-auto mb-6" />
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">Borang Upward Mobility</h1>
                    <p className="mt-4 text-xl text-gray-600">Laporan Sesi iTEKAD BangKIT (Diisi oleh Mentor)</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-12">
                    
                    <FormSection icon={<UserIcon />} title="1. Maklumat Asas Usahawan">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div>
                                <label htmlFor="batch" className="block text-sm font-medium text-gray-700">Batch</label>
                                <select id="batch" value={selectedBatch} onChange={handleBatchChange} className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm">
                                    <option value="">{isLoading ? 'Loading...' : 'Pilih Batch'}</option>
                                    {batches.map(batch => <option key={batch} value={batch}>{batch}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="zone" className="block text-sm font-medium text-gray-700">Zon</label>
                                <select id="zone" value={selectedZone} onChange={handleZoneChange} disabled={!selectedBatch} className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-200">
                                    <option value="">Pilih Zon</option>
                                    {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="mentor" className="block text-sm font-medium text-gray-700">Mentor</label>
                                <select id="mentor" value={selectedMentor} onChange={handleMentorChange} disabled={!selectedZone} className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-200">
                                    <option value="">Pilih Mentor</option>
                                    {mentors.map(mentor => <option key={mentor} value={mentor}>{mentor}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="mentee" className="block text-sm font-medium text-gray-700">Usahawan (Mentee)</label>
                                <select id="mentee" value={selectedMentee} onChange={handleMenteeChange} disabled={!selectedMentor} className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-200">
                                    <option value="">Pilih Usahawan</option>
                                    {mentees.map(m => <option key={m.mentee} value={m.mentee}>{m.mentee}</option>)}
                                </select>
                            </div>
                        </div>

                        {menteeDetails && (
                            <div className="mt-6 p-5 bg-blue-50 border-l-4 border-blue-400">
                                <h3 className="font-semibold text-gray-800">Maklumat Usahawan (Auto)</h3>
                                <div className="mt-2 space-y-1 text-gray-700">
                                    <p><strong>Nama Syarikat:</strong> {menteeDetails.namaSyarikat}</p>
                                    <p><strong>Alamat:</strong> {menteeDetails.alamat}</p>
                                    <p><strong>No. Telefon:</strong> {menteeDetails.noTelefon}</p>
                                </div>
                            </div>
                        )}
                    </FormSection>

                    {selectedMentee && (
                        <>
                            <FormSection icon={<BriefcaseIcon />} title="2. Butiran Laporan">
                                <Input label="Email Address (Mentor)" name="email" value={formData.email} onChange={handleFormChange} required type="email" />
                                <Input label="Jenis Perniagaan dan Produk/Servis" name="jenisPerniagaan" value={formData.jenisPerniagaan} onChange={handleFormChange} required placeholder="Contoh: Jahitan - kain langsir"/>
                                <RadioGroup legend="Sesi Mentoring" name="sesiMentoring" value={formData.sesiMentoring} onChange={handleFormChange} options={[{value: 'Sesi 2', label: 'Sesi 2'}, {value: 'Sesi 4', label: 'Sesi 4'}]} />
                            </FormSection>

                            <FormSection icon={<TrendingUpIcon />} title="3. Status & Mobiliti">
                                <RadioGroup legend="Status Penglibatan Usahawan" name="statusPenglibatan" value={formData.statusPenglibatan} onChange={handleFormChange} options={[
                                    {value: 'Active', label: 'Active - masih aktif dengan bisnes dan sesi mentoring'},
                                    {value: 'Not Active (Contactable)', label: 'Not Active (Contactable) - tidak aktif tetapi masih respon'},
                                    {value: 'Not Involved (Uncontactable)', label: 'Not Involved (Uncontactable) - tiada respon'}
                                ]} />
                                <RadioGroup legend="Upward Mobility Status" name="upwardMobilityStatus" value={formData.upwardMobilityStatus} onChange={handleFormChange} options={[
                                    {value: 'G1', label: 'Grade 1 (G1) - Lulus kemudahan/fasiliti SME'},
                                    {value: 'G2', label: 'Grade 2 (G2) - Berjaya improve credit worthiness'},
                                    {value: 'G3', label: 'Grade 3 (G3) - Improve mana-mana bahagian bisnes'},
                                    {value: 'NIL', label: 'NIL - Tiada peningkatan'}
                                ]} />
                                <Textarea label="Jika G1/G2/G3, nyatakan kriteria improvement" name="kriteriaImprovement" value={formData.kriteriaImprovement} onChange={handleFormChange} placeholder="Contoh: Grade 1 (SME facility from BIMB - property financing)" />
                                <Input label="Tarikh lawatan ke premis (Jika belum, tulis 0)" name="tarikhLawatan" value={formData.tarikhLawatan} onChange={handleFormChange} required />
                            </FormSection>

                            <FormSection icon={<BankIcon />} title="4. Penggunaan Saluran Bank Islam & Fintech">
                                <RadioGroup legend="1. Penggunaan Akaun Semasa BIMB" name="penggunaanAkaunSemasa" value={formData.penggunaanAkaunSemasa} onChange={handleFormChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                                <RadioGroup legend="2. Penggunaan BIMB Biz" name="penggunaanBimbBiz" value={formData.penggunaanBimbBiz} onChange={handleFormChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                                <RadioGroup legend="3. Buka akaun Al-Awfar" name="bukaAkaunAlAwfar" value={formData.bukaAkaunAlAwfar} onChange={handleFormChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                                <RadioGroup legend="4. Penggunaan BIMB Merchant Terminal/Pay2phone" name="penggunaanBimbMerchant" value={formData.penggunaanBimbMerchant} onChange={handleFormChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                                <RadioGroup legend="5. Lain-lain Fasiliti BIMB" name="lainLainFasiliti" value={formData.lainLainFasiliti} onChange={handleFormChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                                <RadioGroup legend="6. Melanggan aplikasi MesinKira" name="langganMesinKira" value={formData.langganMesinKira} onChange={handleFormChange} options={[{value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}]} />
                            </FormSection>

                            <FormSection icon={<DollarSignIcon />} title="5. Situasi Kewangan Perniagaan (Sebelum & Selepas)">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Input label="Jumlah Pendapatan (Sebelum)" name="pendapatanSebelum" value={formData.pendapatanSebelum} onChange={handleFormChange} required type="number" placeholder="RM" />
                                    <Input label="Jumlah Pendapatan (Selepas)" name="pendapatanSelepas" value={formData.pendapatanSelepas} onChange={handleFormChange} required type="number" placeholder="RM" />
                                </div>
                                <Textarea label="Ulasan Mentor (Jumlah Pendapatan)" name="ulasanPendapatan" value={formData.ulasanPendapatan} onChange={handleFormChange} required />
                                
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Input label="Peluang Pekerjaan (Sebelum)" name="pekerjaanSebelum" value={formData.pekerjaanSebelum} onChange={handleFormChange} required type="number" placeholder="Bilangan pekerja" />
                                    <Input label="Peluang Pekerjaan (Selepas)" name="pekerjaanSelepas" value={formData.pekerjaanSelepas} onChange={handleFormChange} required type="number" placeholder="Bilangan pekerja" />
                                </div>
                                <Textarea label="Ulasan Mentor (Peluang Pekerjaan)" name="ulasanPekerjaan" value={formData.ulasanPekerjaan} onChange={handleFormChange} required />

                                <div className="grid md:grid-cols-2 gap-6">
                                    <Input label="Nilai Aset Bukan Tunai (Sebelum)" name="asetBukanTunaiSebelum" value={formData.asetBukanTunaiSebelum} onChange={handleFormChange} required type="number" placeholder="RM" />
                                    <Input label="Nilai Aset Bukan Tunai (Selepas)" name="asetBukanTunaiSelepas" value={formData.asetBukanTunaiSelepas} onChange={handleFormChange} required type="number" placeholder="RM" />
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                     <Input label="Nilai Aset Bentuk Tunai (Sebelum)" name="asetTunaiSebelum" value={formData.asetTunaiSebelum} onChange={handleFormChange} required type="number" placeholder="RM" />
                                    <Input label="Nilai Aset Bentuk Tunai (Selepas)" name="asetTunaiSelepas" value={formData.asetTunaiSelepas} onChange={handleFormChange} required type="number" placeholder="RM" />
                                </div>
                                <Textarea label="Ulasan Mentor (Nilai Aset)" name="ulasanAset" value={formData.ulasanAset} onChange={handleFormChange} required />

                                <div className="grid md:grid-cols-2 gap-6">
                                    <Input label="Simpanan Perniagaan (Sebelum)" name="simpananSebelum" value={formData.simpananSebelum} onChange={handleFormChange} required type="number" placeholder="RM" />
                                    <Input label="Simpanan Perniagaan (Selepas)" name="simpananSelepas" value={formData.simpananSelepas} onChange={handleFormChange} required type="number" placeholder="RM" />
                                </div>
                                <Textarea label="Ulasan Mentor (Simpanan)" name="ulasanSimpanan" value={formData.ulasanSimpanan} onChange={handleFormChange} required />
                                
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Input label="Pembayaran Zakat Perniagaan (Sebelum)" name="zakatSebelum" value={formData.zakatSebelum} onChange={handleFormChange} required type="number" placeholder="RM" />
                                    <Input label="Pembayaran Zakat Perniagaan (Selepas)" name="zakatSelepas" value={formData.zakatSelepas} onChange={handleFormChange} required type="number" placeholder="RM" />
                                </div>
                                <Textarea label="Ulasan Mentor (Pembayaran Zakat)" name="ulasanZakat" value={formData.ulasanZakat} onChange={handleFormChange} required />
                            </FormSection>

                            <FormSection icon={<LaptopIcon />} title="6. Digitalisasi & Pemasaran Online">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <CheckboxGroup legend="Penggunaan Digital (Sebelum)" namePrefix="digitalSebelum" value={formData.digitalSebelum} onChange={handleFormChange} options={[
                                        {value: 'Data asas dan terhad', label: 'Data asas dan terhad'},
                                        {value: 'Pengguna advance', label: 'Pengguna advance'},
                                        {value: 'Transaksi kewangan', label: 'Transaksi kewangan (e-wallet)'},
                                        {value: 'Laman web rasmi', label: 'Laman web rasmi'}
                                    ]} />
                                    <CheckboxGroup legend="Penggunaan Digital (Selepas)" namePrefix="digitalSelepas" value={formData.digitalSelepas} onChange={handleFormChange} options={[
                                        {value: 'Data asas dan terhad', label: 'Data asas dan terhad'},
                                        {value: 'Pengguna advance', label: 'Pengguna advance'},
                                        {value: 'Transaksi kewangan', label: 'Transaksi kewangan (e-wallet)'},
                                        {value: 'Laman web rasmi', label: 'Laman web rasmi'}
                                    ]} />
                                </div>
                                <Textarea label="Ulasan Mentor (Penggunaan Digital)" name="ulasanDigital" value={formData.ulasanDigital} onChange={handleFormChange} required />
                                
                                <div className="grid md:grid-cols-2 gap-8">
                                     <CheckboxGroup legend="Jualan & Pemasaran Online (Sebelum)" namePrefix="onlineSalesSebelum" value={formData.onlineSalesSebelum} onChange={handleFormChange} options={[
                                        {value: 'Jualan Bisnes secara Online', label: 'Jualan Bisnes secara Online (e-commerce)'},
                                        {value: 'Pemasaran secara Online dan Live', label: 'Pemasaran secara Online dan Live (Ads, Live)'},
                                        {value: 'Perniagaan campuran', label: 'Perniagaan campuran (Online & Premis)'},
                                        {value: 'Premis / Kedai fizikal', label: 'Premis / Kedai fizikal'}
                                    ]} />
                                     <CheckboxGroup legend="Jualan & Pemasaran Online (Selepas)" namePrefix="onlineSalesSelepas" value={formData.onlineSalesSelepas} onChange={handleFormChange} options={[
                                        {value: 'Jualan Bisnes secara Online', label: 'Jualan Bisnes secara Online (e-commerce)'},
                                        {value: 'Pemasaran secara Online dan Live', label: 'Pemasaran secara Online dan Live (Ads, Live)'},
                                        {value: 'Perniagaan campuran', label: 'Perniagaan campuran (Online & Premis)'},
                                        {value: 'Premis / Kedai fizikal', label: 'Premis / Kedai fizikal'}
                                    ]} />
                                </div>
                                <Textarea label="Ulasan Mentor (Jualan dan Pemasaran)" name="ulasanOnlineSales" value={formData.ulasanOnlineSales} onChange={handleFormChange} required />
                            </FormSection>

                            <div className="flex justify-end pt-4">
                                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105">
                                    {isSubmitting ? 'Menghantar...' : 'Hantar Laporan'}
                                </button>
                            </div>

                            {submitMessage && (
                                <p className={`text-center font-medium p-4 rounded-lg ${submitMessage.includes('failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{submitMessage}</p>
                            )}
                        </>
                    )}
                </form>
            </div>
        </div>
    </div>
  );
}
