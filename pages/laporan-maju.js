// pages/laporan-maju.js
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Section from '../components/Section';
import InputField from '../components/InputField';
import SelectField from '../components/SelectField';
import TextArea from '../components/TextArea';
import FileInput from '../components/FileInput';
import InfoCard from '../components/InfoCard';
import { format } from 'date-fns';

// Helper function to safely parse JSON
const safeJSONParse = (str) => {
  try {
    if (!str || str.trim() === '') {
      return [];
    }
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing JSON:", e, "Input string:", str);
    return [];
  }
};

// Enhanced TextArea component with removable placeholder
const EnhancedTextArea = ({ label, name, value, onChange, placeholder, rows = 5, required = false, disabled = false }) => {
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [textValue, setTextValue] = useState(value || '');

  useEffect(() => {
    setTextValue(value || '');
    setShowPlaceholder(!value || value.trim() === '');
  }, [value]);

  const handleTextChange = (e) => {
    const newValue = e.target.value;
    setTextValue(newValue);
    setShowPlaceholder(false);

    if (onChange) {
      onChange(e);
    }
  };

  const handleClearPlaceholder = () => {
    setShowPlaceholder(false);
    setTextValue('');

    const syntheticEvent = {
      target: {
        name: name,
        value: ''
      }
    };
    if (onChange) {
      onChange(syntheticEvent);
    }
  };

  const displayValue = showPlaceholder ? placeholder : textValue;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <textarea
          name={name}
          value={displayValue}
          onChange={handleTextChange}
          onClick={() => {
            if (showPlaceholder) {
              setShowPlaceholder(false);
              setTextValue('');
            }
          }}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical ${
            showPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          rows={rows}
          required={required}
          disabled={disabled}
        />
        {showPlaceholder && !disabled && (
          <button
            type="button"
            onClick={handleClearPlaceholder}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm bg-white px-2 py-1 rounded border border-gray-300"
            title="Clear placeholder and start writing"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
};

const LaporanMajuPage = () => {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.includes(session.user.email);

  const initialFormState = {
    // These match your LaporanMaju sheet headers for direct submission
    Timestamp: '',
    NAMA_MENTOR: '',
    EMAIL_MENTOR: '',
    NAMA_MENTEE: '',
    NAMA_BISNES: '',
    LOKASI_BISNES: '',
    PRODUK_SERVIS: '',
    NO_TELEFON: '',
    TARIKH_SESI: format(new Date(), 'yyyy-MM-dd'),
    SESI_NUMBER: 1,
    MOD_SESI: '',
    LOKASI_F2F: '',
    MASA_MULA: '',
    MASA_TAMAT: '',
    LATARBELAKANG_USAHAWAN: '',
    DATA_KEWANGAN_BULANAN_JSON: [],
    MENTORING_FINDINGS_JSON: [],
    REFLEKSI_MENTOR_PERASAAN: '',
    REFLEKSI_MENTOR_KOMITMEN: '',
    REFLEKSI_MENTOR_LAIN: '',
    URL_GAMBAR_PREMIS_JSON: [],
    URL_GAMBAR_SESI_JSON: [],
    URL_GAMBAR_GW360: '',
    Mentee_Folder_ID: '',
    Laporan_Maju_Doc_ID: '',
    // NEW FIELDS for Sesi 2+
    STATUS_PERNIAGAAN_KESELURUHAN: '',
    RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
    // MIA fields
    MIA_PROOF_URL: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [allMenteesMapping, setAllMenteesMapping] = useState([]);
  const [mentorsInMapping, setMentorsInMapping] = useState([]);
  const [filteredMenteesForDropdown, setFilteredMenteesForDropdown] = useState([]);
  const [selectedMentorEmail, setSelectedMentorEmail] = useState(session?.user?.email || '');
  const [currentSessionNumber, setCurrentSessionNumber] = useState(1);
  const [previousMentoringFindings, setPreviousMentoringFindings] = useState([]);
  const [previousLatarBelakangUsahawan, setPreviousLatarBelakangUsahawan] = useState('');
  const [hasPremisPhotosUploaded, setHasPremisPhotosUploaded] = useState(false);
  const [lawatanPremisChecked, setLawatanPremisChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isMIA, setIsMIA] = useState(false);
  const [miaReason, setMiaReason] = useState('');
  const [miaProofFile, setMiaProofFile] = useState(null);

  // Effect to fetch mapping data on component mount
  useEffect(() => {
    const fetchMappingData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/mapping?programType=maju');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAllMenteesMapping(data);

        if (isAdmin) {
          const uniqueMentors = Array.from(new Set(data.map(m => m.Mentor_Email)))
                                .map(email => {
                                  const mentorData = data.find(m => m.Mentor_Email === email);
                                  return { label: mentorData ? mentorData.Mentor : email, value: email };
                                });
          setMentorsInMapping([{ label: 'Pilih Mentor', value: '' }, ...uniqueMentors]);
          if (!selectedMentorEmail && session?.user?.email && uniqueMentors.some(m => m.value === session.user.email)) {
              setSelectedMentorEmail(session.user.email);
          }
        }
      } catch (error) {
        console.error('Error fetching mapping data:', error);
        setMessage('Failed to load mentee mapping data.');
        setMessageType('error');
      } finally {
        setLoading(false);
      }
    };
    fetchMappingData();
  }, [isAdmin, session?.user?.email, selectedMentorEmail]);

  // Effect to update NAMA_MENTOR & EMAIL_MENTOR in formData based on selectedMentorEmail or logged-in user
  useEffect(() => {
    let mentorName = session?.user?.name || '';
    let mentorEmail = session?.user?.email || '';

    if (isAdmin && selectedMentorEmail) {
        const selectedMentorData = allMenteesMapping.find(m => m.Mentor_Email === selectedMentorEmail);
        if (selectedMentorData) {
            mentorName = selectedMentorData.Mentor;
            mentorEmail = selectedMentorData.Mentor_Email;
        }
    } else if (!isAdmin && session?.user?.email) {
        const loggedInMentorData = allMenteesMapping.find(m => m.Mentor_Email === session.user.email);
        if (loggedInMentorData) {
            mentorName = loggedInMentorData.Mentor;
            mentorEmail = loggedInMentorData.Mentor_Email;
        }
    }

    setFormData(prev => ({
        ...prev,
        NAMA_MENTOR: mentorName,
        EMAIL_MENTOR: mentorEmail,
    }));
  }, [selectedMentorEmail, allMenteesMapping, isAdmin, session?.user?.email]);

  // Filter mentees based on selected mentor (or logged-in mentor if not admin)
  useEffect(() => {
    let menteesToDisplay = [];
    if (isAdmin && selectedMentorEmail) {
      menteesToDisplay = allMenteesMapping.filter(m => m.Mentor_Email === selectedMentorEmail);
    } else if (!isAdmin && session?.user?.email) {
      menteesToDisplay = allMenteesMapping.filter(m => m.Mentor_Email === session.user.email);
    }
    setFilteredMenteesForDropdown(menteesToDisplay);
  }, [allMenteesMapping, selectedMentorEmail, isAdmin, session]);

  // Handle Mentee Selection & Load Session Data
  const handleMenteeSelect = useCallback(async (e) => {
    const selectedMenteeName = e.target.value;

    setFormData(prev => ({
      ...prev,
      NAMA_MENTEE: selectedMenteeName,
      NAMA_BISNES: '',
      LOKASI_BISNES: '',
      PRODUK_SERVIS: '',
      NO_TELEFON: '',
      MOD_SESI: '',
      LOKASI_F2F: '',
      MASA_MULA: '',
      MASA_TAMAT: '',
      LATARBELAKANG_USAHAWAN: '',
      DATA_KEWANGAN_BULANAN_JSON: [],
      MENTORING_FINDINGS_JSON: [],
      REFLEKSI_MENTOR_PERASAAN: '',
      REFLEKSI_MENTOR_KOMITMEN: '',
      REFLEKSI_MENTOR_LAIN: '',
      URL_GAMBAR_GW360: '',
      URL_GAMBAR_SESI_JSON: [],
      URL_GAMBAR_PREMIS_JSON: [],
      Mentee_Folder_ID: '',
      Laporan_Maju_Doc_ID: '',
      STATUS_PERNIAGAAN_KESELURUHAN: '',
      RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
    }));

    setCurrentSessionNumber(1);
    setPreviousMentoringFindings([]);
    setPreviousLatarBelakangUsahawan('');
    setHasPremisPhotosUploaded(false);
    setLawatanPremisChecked(false);
    setIsMIA(false);
    setMiaReason('');
    setMiaProofFile(null);

    if (!selectedMenteeName) {
      setMessage('');
      setMessageType('');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const response = await fetch(`/api/laporanMajuData?name=${encodeURIComponent(selectedMenteeName)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const sessionData = await response.json();

      setFormData(prev => {
        const updatedFormData = { ...prev };

        if (sessionData.menteeMapping) {
          updatedFormData.NAMA_BISNES = sessionData.menteeMapping.NAMA_BISNES || '';
          updatedFormData.LOKASI_BISNES = sessionData.menteeMapping.LOKASI_BISNES || '';
          updatedFormData.PRODUK_SERVIS = sessionData.menteeMapping.PRODUK_SERVIS || '';
          updatedFormData.NO_TELEFON = sessionData.menteeMapping.NO_TELEFON || '';
          updatedFormData.Mentee_Folder_ID = sessionData.menteeMapping.Mentee_Folder_ID || '';
        }

        updatedFormData.SESI_NUMBER = sessionData.currentSession || 1;
        setCurrentSessionNumber(sessionData.currentSession || 1);
        setIsMIA(sessionData.isMIA || false);

        if (sessionData.currentSession > 1 && sessionData.previousData) {
          setPreviousMentoringFindings(safeJSONParse(sessionData.previousData.MENTORING_FINDINGS_JSON));
          updatedFormData.DATA_KEWANGAN_BULANAN_JSON = safeJSONParse(sessionData.previousData.DATA_KEWANGAN_BULANAN_JSON);
        } else {
          setPreviousMentoringFindings([]);
          updatedFormData.DATA_KEWANGAN_BULANAN_JSON = [];
        }

        setPreviousLatarBelakangUsahawan(sessionData.latarBelakangUsahawanSesi1 || '');
        if (sessionData.currentSession === 1 && sessionData.latarBelakangUsahawanSesi1) {
            updatedFormData.LATARBELAKANG_USAHAWAN = sessionData.latarBelakangUsahawanSesi1;
        } else {
            updatedFormData.LATARBELAKANG_USAHAWAN = '';
        }

        setHasPremisPhotosUploaded(sessionData.hasPremisPhotos || false);

        return updatedFormData;
      });

    } catch (error) {
      console.error('Error fetching mentee session data:', error);
      setMessage('Failed to load mentee data and session info. Please check console for details.');
      setMessageType('error');
      setFormData(prev => ({
        ...initialFormState,
        NAMA_MENTOR: prev.NAMA_MENTOR,
        EMAIL_MENTOR: prev.EMAIL_MENTOR,
        TARIKH_SESI: format(new Date(), 'yyyy-MM-dd'),
        NAMA_MENTEE: selectedMenteeName,
      }));
      setCurrentSessionNumber(1);
      setPreviousMentoringFindings([]);
      setPreviousLatarBelakangUsahawan('');
      setHasPremisPhotosUploaded(false);
      setLawatanPremisChecked(false);
      setIsMIA(false);
      setMiaReason('');
      setMiaProofFile(null);
    } finally {
      setLoading(false);
    }
  }, [initialFormState, isAdmin, session]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDynamicChange = (section, index, field, value) => {
    setFormData(prev => {
      const updatedSection = [...prev[section]];
      if (!updatedSection[index]) {
        updatedSection[index] = {};
      }
      updatedSection[index] = { ...updatedSection[index], [field]: value };
      return { ...prev, [section]: updatedSection };
    });
  };

  const addRow = (section, initialRow = {}) => {
    setFormData(prev => ({
      ...prev,
      [section]: [...prev[section], initialRow]
    }));
  };

  const removeRow = (section, index) => {
    setFormData(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index)
    }));
  };

  // UPDATED: handleFileChange to use reportType: 'sesi' for all image uploads
  const handleFileChange = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!formData.Mentee_Folder_ID) {
      setMessage('Please select a mentee first to get their folder ID before uploading images.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage(`Uploading ${files.length} file(s)...`);
    setMessageType('');

    const uploadedUrls = [];

    for (const file of files) {
      try {
        const fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        let imageType = '';
        if (fieldName === 'URL_GAMBAR_GW360') {
          imageType = 'gw';
        } else if (fieldName === 'URL_GAMBAR_SESI_JSON') {
          imageType = 'sesi';
        } else if (fieldName === 'URL_GAMBAR_PREMIS_JSON') {
          imageType = 'premis';
        }

        const uploadPayload = {
          action: 'uploadImage',
          fileData: fileData,
          fileName: file.name,
          fileType: file.type,
          folderId: formData.Mentee_Folder_ID,
          menteeName: formData.NAMA_MENTEE,
          sessionNumber: currentSessionNumber,
          reportType: 'sesi', // <--- IMPORTANT CHANGE: Route image uploads to Sesi Apps Script
          isMIAProof: false,
          imageType: imageType
        };

        console.log('📤 Uploading file via Apps Script proxy:', file.name);
        console.log('🆔 Using folder ID:', formData.Mentee_Folder_ID);

        const response = await fetch('/api/upload-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadPayload),
        });

        console.log('📥 Upload response status:', response.status);

        const data = await response.json();
        console.log('📄 Upload response data:', data);

        if (data.url) {
          uploadedUrls.push(data.url);
        } else {
          throw new Error('No URL returned from upload');
        }
      } catch (error) {
        console.error(`❌ Error uploading ${file.name}:`, error);
        setMessage(`Failed to upload ${file.name}.`);
        setMessageType('error');
        setLoading(false);
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [fieldName]: fieldName === 'URL_GAMBAR_GW360' ? uploadedUrls[0] : [...prev[fieldName], ...uploadedUrls]
    }));
    setMessage('Files uploaded successfully!');
    setMessageType('success');
    setLoading(false);
  };

  // NEW: handleMiaProofFileChange function for MIA proof uploads
  const handleMiaProofFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!formData.Mentee_Folder_ID) {
      setMessage('Please select a mentee first to get their folder ID before uploading MIA proof.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage(`Uploading MIA proof: ${file.name}...`);
    setMessageType('');

    try {
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadPayload = {
        action: 'uploadImage', // Action for image upload
        fileData: fileData,
        fileName: file.name,
        fileType: file.type,
        folderId: formData.Mentee_Folder_ID,
        menteeName: formData.NAMA_MENTEE,
        sessionNumber: currentSessionNumber,
        reportType: 'sesi', // <--- IMPORTANT CHANGE: Route MIA proof to Sesi Apps Script
        isMIAProof: true,
        imageType: 'mia'
      };

      console.log('📤 Uploading MIA proof via Apps Script proxy:', file.name);

      const response = await fetch('/api/upload-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadPayload),
      });

      const data = await response.json();

      if (data.url) {
        setFormData(prev => ({
          ...prev,
          MIA_PROOF_URL: data.url
        }));
        setMiaProofFile(file);
        setMessage('MIA proof uploaded successfully!');
        setMessageType('success');
      } else {
        throw new Error(data.message || 'No URL returned from MIA proof upload');
      }
    } catch (error) {
      console.error(`❌ Error uploading MIA proof ${file.name}:`, error);
      setMessage(`Failed to upload MIA proof: ${error.message}`);
      setMessageType('error');
      setMiaProofFile(null);
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setFormData({
      ...initialFormState,
      NAMA_MENTOR: isAdmin ? (mentorsInMapping.find(m => m.value === selectedMentorEmail)?.label || '') : (session?.user?.name || ''),
      EMAIL_MENTOR: isAdmin ? selectedMentorEmail : (session?.user?.email || ''),
      TARIKH_SESI: format(new Date(), 'yyyy-MM-dd'),
    });
    setCurrentSessionNumber(1);
    setPreviousMentoringFindings([]);
    setPreviousLatarBelakangUsahawan('');
    setHasPremisPhotosUploaded(false);
    setLawatanPremisChecked(false);
    setMessage('');
    setMessageType('');
    setLoading(false);
    setIsMIA(false);
    setMiaReason('');
    setMiaProofFile(null);

    // Clear all file inputs in the DOM
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.value = '';
    });

    // Clear any "Uploaded" status messages by resetting the page display
    console.log('✅ Form reset complete - all fields and file inputs cleared');
  };

  // UPDATED: handleSubmit to include 'action' and 'reportType: maju'
// In your laporan-maju.js, update the handleSubmit function's response handling:

// In your laporan-maju.js handleSubmit function, make sure dataToSend is properly defined:

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setMessage('');
  setMessageType('');

  console.log('🚀 Starting form submission...');

  try {
    // ✅ MAKE SURE dataToSend is declared in the correct scope
    let dataToSend = {}; // ← Declare it here at the top

    // CONDITIONALLY BUILD dataToSend BASED ON MIA STATUS
    if (isMIA) {
      const miaProofUrl = formData.MIA_PROOF_URL || '';
      console.log('📋 Building MIA data to send...');
      
      dataToSend = {
        NAMA_MENTOR: formData.NAMA_MENTOR,
        EMAIL_MENTOR: formData.EMAIL_MENTOR,
        NAMA_MENTEE: formData.NAMA_MENTEE,
        NAMA_BISNES: formData.NAMA_BISNES,
        SESI_NUMBER: currentSessionNumber,
        LOKASI_BISNES: '',
        PRODUK_SERVIS: '',
        NO_TELEFON: '',
        TARIKH_SESI: '',
        MOD_SESI: '',
        LOKASI_F2F: '',
        MASA_MULA: '',
        MASA_TAMAT: '',
        LATARBELAKANG_USAHAWAN: '',
        DATA_KEWANGAN_BULANAN_JSON: [],
        MENTORING_FINDINGS_JSON: [],
        REFLEKSI_MENTOR_PERASAAN: '',
        REFLEKSI_MENTOR_KOMITMEN: '',
        REFLEKSI_MENTOR_LAIN: '',
        URL_GAMBAR_PREMIS_JSON: [],
        URL_GAMBAR_SESI_JSON: [],
        URL_GAMBAR_GW360: '',
        Mentee_Folder_ID: formData.Mentee_Folder_ID,
        Laporan_Maju_Doc_ID: '',
        STATUS_PERNIAGAAN_KESELURUHAN: '',
        RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
        MIA_STATUS: 'MIA',
        MIA_REASON: miaReason,
        MIA_PROOF_URL: miaProofUrl,
      };
    } else {
      console.log('📋 Building regular report data to send...');
      
      dataToSend = {
        NAMA_MENTOR: formData.NAMA_MENTOR,
        EMAIL_MENTOR: formData.EMAIL_MENTOR,
        NAMA_MENTEE: formData.NAMA_MENTEE,
        NAMA_BISNES: formData.NAMA_BISNES,
        SESI_NUMBER: currentSessionNumber,
        LOKASI_BISNES: formData.LOKASI_BISNES,
        PRODUK_SERVIS: formData.PRODUK_SERVIS,
        NO_TELEFON: formData.NO_TELEFON,
        TARIKH_SESI: formData.TARIKH_SESI,
        MOD_SESI: formData.MOD_SESI,
        LOKASI_F2F: formData.LOKASI_F2F,
        MASA_MULA: formData.MASA_MULA,
        MASA_TAMAT: formData.MASA_TAMAT,
        LATARBELAKANG_USAHAWAN: currentSessionNumber === 1 ? formData.LATARBELAKANG_USAHAWAN : previousLatarBelakangUsahawan,
        DATA_KEWANGAN_BULANAN_JSON: formData.DATA_KEWANGAN_BULANAN_JSON,
        MENTORING_FINDINGS_JSON: formData.MENTORING_FINDINGS_JSON,
        REFLEKSI_MENTOR_PERASAAN: formData.REFLEKSI_MENTOR_PERASAAN,
        REFLEKSI_MENTOR_KOMITMEN: formData.REFLEKSI_MENTOR_KOMITMEN,
        REFLEKSI_MENTOR_LAIN: formData.REFLEKSI_MENTOR_LAIN,
        URL_GAMBAR_PREMIS_JSON: formData.URL_GAMBAR_PREMIS_JSON,
        URL_GAMBAR_SESI_JSON: formData.URL_GAMBAR_SESI_JSON,
        URL_GAMBAR_GW360: formData.URL_GAMBAR_GW360,
        Mentee_Folder_ID: formData.Mentee_Folder_ID,
        Laporan_Maju_Doc_ID: '',
        STATUS_PERNIAGAAN_KESELURUHAN: formData.STATUS_PERNIAGAAN_KESELURUHAN || '',
        RUMUSAN_DAN_LANGKAH_KEHADAPAN: formData.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '',
        MIA_STATUS: 'Tidak MIA',
        MIA_REASON: '',
        MIA_PROOF_URL: '',
      };
    }

    // ✅ Now dataToSend is properly defined and can be used
    console.log('📤 Data to send:', dataToSend);
    console.log('🌐 Submitting to /api/submitMajuReport...');

    const response = await fetch('/api/submitMajuReport', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend), // ← This should work now
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);

    const responseText = await response.text();
    console.log('📄 Raw response text:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('📄 Parsed response JSON:', result);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      throw new Error(`Server returned non-JSON response: ${responseText}`);
    }

    if (response.ok && result.success === true) {
      console.log('✅ Submission successful!');
      setMessage(result.message || 'Laporan submitted successfully!');
      setMessageType('success');
      resetForm();
    } else {
      console.error('❌ Submission failed:', result);
      const errorMessage = result.error || result.message || 'Submission failed';
      throw new Error(errorMessage);
    }

  } catch (error) {
    console.error('❌ Detailed submission error:', error);
    setMessage(`Failed to submit Laporan: ${error.message}`);
    setMessageType('error');
  } finally {
    setLoading(false);
  }
};
  // Early returns for authentication and session limits
  if (!session) {
    return <InfoCard title="Authentication Required">Please log in to access this page.</InfoCard>;
  }

  if (currentSessionNumber > 4 && formData.NAMA_MENTEE) {
    return (
      <div className="bg-gray-100 min-h-screen font-sans">
        <header className="text-center bg-white p-6 rounded-lg shadow-sm mb-6 max-w-4xl mx-auto">
          <img src="/logo1.png" alt="Logo" className="mx-auto h-20 mb-2" />
          <h1 className="text-3xl font-bold text-gray-800">Borang Laporan Maju</h1>
          <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>
        </header>

        <div className="container mx-auto p-4 max-w-4xl">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <InfoCard title="Sesi Mentoring Lengkap" type="info">
              <p className="text-lg">
                Semua sesi mentoring untuk <strong>{formData.NAMA_MENTEE}</strong> telah lengkap (Sesi 1 hingga 4 telah direkodkan).
                <br />
                Tiada borang laporan maju baru diperlukan untuk mentee ini.
              </p>
              <button
                onClick={resetForm}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Pilih Mentee Lain
              </button>
            </InfoCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      {/* Header: white card with logo + title */}
      <header className="text-center bg-white p-6 rounded-lg shadow-sm mb-6 max-w-4xl mx-auto">
        <img src="/logo1.png" alt="Logo" className="mx-auto h-20 mb-2" />
        <h1 className="text-3xl font-bold text-gray-800">Borang Laporan Maju</h1>
        <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>
      </header>

      {/* Main content */}
      <div className="container mx-auto p-4 max-w-4xl space-y-6">
        {/* Message / Loading (as cards for consistency) */}
        {message && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <InfoCard title={messageType === 'success' ? 'Success' : 'Error'} type={messageType}>
              {message}
            </InfoCard>
          </div>
        )}

        {loading && (
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            <p className="text-blue-500">Loading...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* MIA Checkbox always visible at the top */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            {isMIA && formData.NAMA_MENTEE && (
              <InfoCard title="Usahawan ini telah ditandakan sebagai MIA." type="info">
                <p>Anda hanya boleh menghantar laporan MIA untuk mentee ini.</p>
                <p>Sila nyatakan alasan dan muat naik bukti.</p>
              </InfoCard>
            )}
            <label className="flex items-center mt-4">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-red-600"
                checked={isMIA}
                onChange={(e) => setIsMIA(e.target.checked)}
                disabled={isMIA && (formData.NAMA_MENTEE && currentSessionNumber > 1)}
              />
              <span className="ml-2 text-lg font-semibold text-gray-800">Tandakan jika Usahawan Tidak Hadir / MIA</span>
            </label>
          </div>

          {/* Conditional rendering based on isMIA status */}
          {isMIA ? (
            /* MIA Form Section */
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <Section title="Laporan Status MIA">
                <InputField
                  label="Nama Mentee"
                  name="NAMA_MENTEE"
                  value={formData.NAMA_MENTEE}
                  disabled
                />
                <InputField
                  label="Nombor Sesi"
                  name="SESI_NUMBER_DISPLAY"
                  value={`Sesi #${currentSessionNumber}`}
                  disabled
                />
                <TextArea
                  label="Alasan / Sebab Usahawan MIA"
                  name="miaReason"
                  value={miaReason}
                  onChange={(e) => setMiaReason(e.target.value)}
                  required
                  rows={4}
                  placeholder="Cth: Telah dihubungi 3 kali melalui WhatsApp pada 01/08/2025, tiada jawapan."
                />
                <FileInput
                  label="Muat Naik Bukti (Cth: Screenshot Perbualan)"
                  name="miaProof"
                  onFileChange={handleMiaProofFileChange} // <--- Ensure this uses the new handler
                  multiple={false}
                />
                {miaProofFile && (
                  <div className="mt-2 text-sm text-gray-600">
                    File selected: {miaProofFile.name}
                  </div>
                )}
              </Section>
            </div>
          ) : (
            <>
              {/* --- Maklumat Sesi --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Maklumat Sesi">
                  {isAdmin && (
                    <SelectField
                      label="Pilih Mentor"
                      name="mentorSelection"
                      value={selectedMentorEmail}
                      onChange={(e) => setSelectedMentorEmail(e.target.value)}
                      options={mentorsInMapping}
                      required
                    />
                  )}
                  <InputField label="Nama Mentor" name="NAMA_MENTOR" value={formData.NAMA_MENTOR} disabled />
                  <SelectField
                    label="Nama Mentee"
                    name="NAMA_MENTEE"
                    value={formData.NAMA_MENTEE}
                    onChange={handleMenteeSelect}
                    options={[
                      { label: 'Pilih Mentee', value: '' },
                      ...filteredMenteesForDropdown.map(m => ({ label: m.Usahawan, value: m.Usahawan })),
                    ]}
                    required
                  />
                  <InputField label="Nama Bisnes" name="NAMA_BISNES" value={formData.NAMA_BISNES} disabled />
                  <InputField label="Lokasi Bisnes" name="LOKASI_BISNES" value={formData.LOKASI_BISNES} disabled />
                  <InputField label="Produk/Servis" name="PRODUK_SERVIS" value={formData.PRODUK_SERVIS} disabled />
                  <InputField label="No Telefon Mentee" name="NO_TELEFON" value={formData.NO_TELEFON} disabled />
                  <InputField
                    label="Tarikh Sesi"
                    name="TARIKH_SESI"
                    type="date"
                    value={formData.TARIKH_SESI}
                    onChange={handleChange}
                    required
                  />
                  <InputField label="Nombor Sesi" name="SESI_NUMBER_DISPLAY" value={`Sesi #${currentSessionNumber}`} disabled />
                  <SelectField
                    label="Mod Sesi"
                    name="MOD_SESI"
                    value={formData.MOD_SESI}
                    onChange={handleChange}
                    options={[
                      { label: 'Pilih Mod Sesi', value: '' },
                      { label: 'Face to Face', value: 'Face to Face' },
                      { label: 'Online', value: 'Online' },
                    ]}
                    required
                  />
                  {formData.MOD_SESI === 'Face to Face' && (
                    <InputField
                      label="Lokasi F2F"
                      name="LOKASI_F2F"
                      value={formData.LOKASI_F2F}
                      onChange={handleChange}
                      required
                    />
                  )}
                  <InputField
                    label="Masa Mula"
                    name="MASA_MULA"
                    type="time"
                    value={formData.MASA_MULA}
                    onChange={handleChange}
                    required
                  />
                  <InputField
                    label="Masa Tamat"
                    name="MASA_TAMAT"
                    type="time"
                    value={formData.MASA_TAMAT}
                    onChange={handleChange}
                    required
                  />
                </Section>
              </div>

              {/* --- Enhanced Latar Belakang Section --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Latar Belakang Usahawan & Situasi Bisnes">
                  {currentSessionNumber > 1 && previousLatarBelakangUsahawan && (
                    <InfoCard title="Ringkasan Latar Belakang Usahawan (Sesi 1)" type="info">
                      <p className="whitespace-pre-wrap">{previousLatarBelakangUsahawan}</p>
                    </InfoCard>
                  )}

                  {currentSessionNumber === 1 ? (
                    <EnhancedTextArea
                      label="Latar Belakang Usahawan"
                      name="LATARBELAKANG_USAHAWAN"
                      value={formData.LATARBELAKANG_USAHAWAN}
                      onChange={handleChange}
                      required={true}
                      rows={8}
                      placeholder={`Panduan:
Latarbelakang usahawan.
Penerangan produk/perkhidmatan.
Situasi bisnes ketika ini:
- Sistem bisnes
- Sejauh mana usahawan jelas dengan segmen pelanggan dan nilai yang ditawarkan
- Aktiviti pemasaran dan jualan
- Perekodan maklumat akaun, sistem yang digunakan
Apa yang usahawan mahu capai kedepan.
Pemerhatian Mentor/Coach (apa yang bagus, apa yang kurang dan boleh ditambahbaik oleh usahawan)
Kenalpasti bahagian yang boleh nampak peningkatan sebelum dan selepas setahun lalui program:
- Pendapatan
- Keuntungan
- Penambahan pekerja
- Adaptasi teknologi
- Peningkatan skil/pengetahuan`}
                    />
                  ) : (
                    <TextArea
                      label="Latar Belakang Usahawan"
                      name="LATARBELAKANG_USAHAWAN"
                      value={previousLatarBelakangUsahawan}
                      disabled={true}
                      rows={5}
                      placeholder="Latar Belakang Usahawan can only be edited in Sesi 1. Displaying previous entry."
                    />
                  )}
                </Section>
              </div>

              {/* --- Data Kewangan Bulanan --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Data Kewangan Bulanan">
                  {formData.DATA_KEWANGAN_BULANAN_JSON.map((data, index) => (
                    <div key={index} className="border p-4 mb-4 rounded-md bg-gray-50">
                      <h4 className="font-semibold text-gray-700 mb-2">Bulan #{index + 1}</h4>
                      <InputField
                        label="Bulan"
                        name="Bulan"
                        value={data.Bulan || ''}
                        onChange={(e) => handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Bulan', e.target.value)}
                      />
                      <InputField
                        label="Jumlah Jualan (RM)"
                        name="Jumlah Jualan"
                        type="number"
                        value={data['Jumlah Jualan'] || ''}
                        onChange={(e) =>
                          handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Jumlah Jualan', parseFloat(e.target.value) || 0)
                        }
                      />
                      <InputField
                        label="Kos Jualan (RM)"
                        name="Kos Jualan"
                        type="number"
                        value={data['Kos Jualan'] || ''}
                        onChange={(e) =>
                          handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Kos Jualan', parseFloat(e.target.value) || 0)
                        }
                      />
                      <InputField
                        label="Perbelanjaan Tetap (RM)"
                        name="Perbelanjaan Tetap"
                        type="number"
                        value={data['Perbelanjaan Tetap'] || ''}
                        onChange={(e) =>
                          handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Perbelanjaan Tetap', parseFloat(e.target.value) || 0)
                        }
                      />
                      <InputField
                        label="Lebihan Tunai (RM)"
                        name="Lebihan Tunai"
                        type="number"
                        value={data['Lebihan Tunai'] || ''}
                        onChange={(e) =>
                          handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Lebihan Tunai', parseFloat(e.target.value) || 0)
                        }
                      />
                      <TextArea
                        label="Ulasan Mentor"
                        name="Ulasan Mentor"
                        value={data['Ulasan Mentor'] || ''}
                        onChange={(e) =>
                          handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Ulasan Mentor', e.target.value)
                        }
                        rows={2}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow('DATA_KEWANGAN_BULANAN_JSON', index)}
                        className="mt-2 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                      >
                        Remove Bulan
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      addRow('DATA_KEWANGAN_BULANAN_JSON', {
                        Bulan: '',
                        'Jumlah Jualan': '',
                        'Kos Jualan': '',
                        'Perbelanjaan Tetap': '',
                        'Lebihan Tunai': '',
                        'Ulasan Mentor': '',
                      })
                    }
                    className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Add Bulan Data
                  </button>
                </Section>
              </div>

              {/* --- Dapatan Sesi Mentoring --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Dapatan Sesi Mentoring">
                  {currentSessionNumber > 1 && previousMentoringFindings.length > 0 && (
                    <InfoCard title={`Ringkasan Inisiatif Sesi Lalu (Sesi #${currentSessionNumber - 1})`} type="info">
                      <ul className="list-disc pl-5">
                        {previousMentoringFindings.map((finding, index) => (
                          <li key={index} className="mb-2">
                            <p className="font-semibold">{finding['Topik Perbincangan']}</p>
                            <p>Hasil Diharapkan: {finding['Hasil yang Diharapkan']}</p>
                            <p>Kemajuan: {finding['Kemajuan Mentee']}</p>
                            <p>Cabaran: {finding['Cabaran dan Halangan Mentee']}</p>
                            {finding['Pelan Tindakan'] && Array.isArray(finding['Pelan Tindakan']) && finding['Pelan Tindakan'].length > 0 && (
                              <ul className="list-disc list-inside pl-5 mt-1 text-sm text-gray-600">
                                {finding['Pelan Tindakan'].map((plan, pIndex) => (
                                  <li key={pIndex}>
                                    {plan.Tindakan} (Jangkaan Siap: {plan['Jangkaan tarikh siap'] || 'N/A'}) - {plan.Catatan}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </InfoCard>
                  )}

                  {formData.MENTORING_FINDINGS_JSON.map((finding, index) => (
                    <div key={index} className="border p-4 mb-4 rounded-md bg-gray-50">
                      <h4 className="font-semibold text-gray-700 mb-2">Dapatan Mentoring #{index + 1}</h4>
                      <InputField
                        label="Topik Perbincangan"
                        name="Topik Perbincangan"
                        value={finding['Topik Perbincangan'] || ''}
                        onChange={(e) => handleDynamicChange('MENTORING_FINDINGS_JSON', index, 'Topik Perbincangan', e.target.value)}
                      />
                      <InputField
                        label="Hasil yang Diharapkan"
                        name="Hasil yang Diharapkan"
                        value={finding['Hasil yang Diharapkan'] || ''}
                        onChange={(e) => handleDynamicChange('MENTORING_FINDINGS_JSON', index, 'Hasil yang Diharapkan', e.target.value)}
                      />
                      <TextArea
                        label="Kemajuan Mentee"
                        name="Kemajuan Mentee"
                        value={finding['Kemajuan Mentee'] || ''}
                        onChange={(e) => handleDynamicChange('MENTORING_FINDINGS_JSON', index, 'Kemajuan Mentee', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        label="Cabaran dan Halangan Mentee"
                        name="Cabaran dan Halangan Mentee"
                        value={finding['Cabaran dan Halangan Mentee'] || ''}
                        onChange={(e) => handleDynamicChange('MENTORING_FINDINGS_JSON', index, 'Cabaran dan Halangan Mentee', e.target.value)}
                        rows={3}
                      />

                      <h5 className="font-semibold mt-4 mb-2">Pelan Tindakan</h5>
                      {(finding['Pelan Tindakan'] || []).map((plan, pIndex) => (
                        <div key={pIndex} className="border p-3 mb-2 rounded-md bg-gray-100">
                          <InputField
                            label="Tindakan"
                            name="Tindakan"
                            value={plan.Tindakan || ''}
                            onChange={(e) => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'][pIndex].Tindakan = e.target.value;
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                          />
                          <InputField
                            label="Jangkaan Tarikh Siap"
                            name="Jangkaan tarikh siap"
                            type="date"
                            value={plan['Jangkaan tarikh siap'] || ''}
                            onChange={(e) => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'][pIndex]['Jangkaan tarikh siap'] = e.target.value;
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                          />
                          <TextArea
                            label="Catatan"
                            name="Catatan"
                            value={plan.Catatan || ''}
                            onChange={(e) => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'][pIndex].Catatan = e.target.value;
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                            rows={2}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'] =
                                updatedFindings[index]['Pelan Tindakan'].filter((_, i) => i !== pIndex);
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                            className="mt-2 bg-red-400 text-white px-2 py-1 rounded-md text-xs hover:bg-red-500"
                          >
                            Remove Pelan Tindakan
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                          if (!updatedFindings[index]) {
                            updatedFindings[index] = {
                              'Topik Perbincangan': '',
                              'Hasil yang Diharapkan': '',
                              'Kemajuan Mentee': '',
                              'Cabaran dan Halangan Mentee': '',
                              'Pelan Tindakan': [],
                            };
                          }
                          if (!updatedFindings[index]['Pelan Tindakan']) {
                            updatedFindings[index]['Pelan Tindakan'] = [];
                          }
                          updatedFindings[index]['Pelan Tindakan'].push({
                            Tindakan: '',
                            'Jangkaan tarikh siap': '',
                            Catatan: '',
                          });
                          setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                        }}
                        className="mt-2 bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                      >
                        Add Pelan Tindakan
                      </button>

                      <button
                        type="button"
                        onClick={() => removeRow('MENTORING_FINDINGS_JSON', index)}
                        className="mt-4 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                      >
                        Remove Dapatan Mentoring
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      addRow('MENTORING_FINDINGS_JSON', {
                        'Topik Perbincangan': '',
                        'Hasil yang Diharapkan': '',
                        'Kemajuan Mentee': '',
                        'Cabaran dan Halangan Mentee': '',
                        'Pelan Tindakan': [],
                      })
                    }
                    className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Add Dapatan Mentoring
                  </button>
                </Section>
              </div>

              {/* --- NEW Rumusan & Langkah Kehadapan Section (Sesi 2+) --- */}
              {currentSessionNumber >= 2 && (
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <Section title="Rumusan Keseluruhan dan Langkah Kehadapan">
                    <EnhancedTextArea
                      label="Status Perniagaan Keseluruhan"
                      name="STATUS_PERNIAGAAN_KESELURUHAN"
                      value={formData.STATUS_PERNIAGAAN_KESELURUHAN || ''}
                      onChange={handleChange}
                      required={false}
                      rows={6}
                      placeholder={`Panduan:
- Aktiviti pemasaran dan jualan
- Perekodan maklumat akaun, sistem yang digunakan
Apa yang usahawan mahu capai kedepan.
Pemerhatian Mentor/Coach (apa yang bagus, apa yang kurang dan boleh ditambahbaik oleh usahawan)
Kenalpasti bahagian yang boleh nampak peningkatan sebelum dan selepas setahun lalui program:
- Pendapatan
- Keuntungan
- Penambahan pekerja
- Adaptasi teknologi
- Peningkatan skil/pengetahuan`}
                    />

                    <EnhancedTextArea
                      label="Rumusan Keseluruhan dan Langkah Kehadapan"
                      name="RUMUSAN_DAN_LANGKAH_KEHADAPAN"
                      value={formData.RUMUSAN_DAN_LANGKAH_KEHADAPAN || ''}
                      onChange={handleChange}
                      required={false}
                      rows={8}
                      placeholder={`Nota:
Pastikan peserta pulang dengan Keputusan dan Tindakan yang perlu diusahakan, siapa dan bila. (Kongsikan/pastika usahawan juga jelas)
Apakah ada homework untuk peserta.
Sebaiknya, tetapkan masa pertemuan sesi akan datang, dan mod perbincangan.
Apakah bantuan, latihan yang mahu dicadangkan kepada HQ untuk membantu usahawan.
Apakah mentor ada bahan tambahan yang dapat membantu usahawan.
Apakah mentor perlukan bahan tambahan/banuan dari mentor mentor lain atau HQ.
Rumus poin-poin penting yang perlu diberi perhatian atau penekanan baik isu berkaitan bisnes mahupun tingkahlaku atau komitmen peserta.`}
                    />
                  </Section>
                </div>
              )}

              {/* --- Refleksi Mentor --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Refleksi Mentor">
                  <TextArea
                    label="Perasaan Mentor Setelah Sesi Ini"
                    name="REFLEKSI_MENTOR_PERASAAN"
                    value={formData.REFLEKSI_MENTOR_PERASAAN}
                    onChange={handleChange}
                    required
                    rows={4}
                  />
                  <TextArea
                    label="Komitmen Mentor Untuk Menolong Mentee"
                    name="REFLEKSI_MENTOR_KOMITMEN"
                    value={formData.REFLEKSI_MENTOR_KOMITMEN}
                    onChange={handleChange}
                    required
                    rows={4}
                  />
                  <TextArea
                    label="Lain-lain Catatan Refleksi Mentor"
                    name="REFLEKSI_MENTOR_LAIN"
                    value={formData.REFLEKSI_MENTOR_LAIN}
                    onChange={handleChange}
                    rows={4}
                  />
                </Section>
              </div>

              {/* --- Lampiran Gambar --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Lampiran Gambar">
                  {currentSessionNumber === 1 && (
                    <FileInput
                      label="Gambar GW360 (Sesi 1 Sahaja)"
                      name="URL_GAMBAR_GW360"
                      onFileChange={(e) => handleFileChange(e, 'URL_GAMBAR_GW360')}
                      multiple={false}
                      required={currentSessionNumber === 1}
                    />
                  )}
                  {formData.URL_GAMBAR_GW360 && currentSessionNumber === 1 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">
                        Uploaded GW360:{' '}
                        <a
                          href={formData.URL_GAMBAR_GW360}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View Image
                        </a>
                      </p>
                    </div>
                  )}

                  <FileInput
                    label="Gambar Sesi (Pelbagai Gambar)"
                    name="URL_GAMBAR_SESI_JSON"
                    onFileChange={(e) => handleFileChange(e, 'URL_GAMBAR_SESI_JSON')}
                    multiple={true}
                    required
                  />
                  {formData.URL_GAMBAR_SESI_JSON.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">Uploaded Sesi Images:</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.URL_GAMBAR_SESI_JSON.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-sm"
                          >
                            Image {index + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasPremisPhotosUploaded ? (
                    <div>
                      <label className="flex items-center mt-4">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={lawatanPremisChecked}
                          onChange={() => setLawatanPremisChecked(!lawatanPremisChecked)}
                        />
                        <span className="ml-2 text-gray-700">Lawatan Premis Telah Dijalankan?</span>
                      </label>
                      {lawatanPremisChecked && (
                        <FileInput
                          label="Gambar Premis (Pelbagai Gambar)"
                          name="URL_GAMBAR_PREMIS_JSON"
                          onFileChange={(e) => handleFileChange(e, 'URL_GAMBAR_PREMIS_JSON')}
                          multiple={true}
                          required={lawatanPremisChecked}
                        />
                      )}
                      {formData.URL_GAMBAR_PREMIS_JSON.length > 0 && lawatanPremisChecked && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">Uploaded Premis Images:</p>
                          <div className="flex flex-wrap gap-2">
                            {formData.URL_GAMBAR_PREMIS_JSON.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline text-sm"
                              >
                                Image {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <InfoCard title="Lawatan Premis Status" type="info">
                      Lawatan Premis telah direkodkan.
                    </InfoCard>
                  )}
                </Section>
              </div>

              {/* --- Bahagian Upward Mobility --- */}
              {(currentSessionNumber === 2 || currentSessionNumber === 4) && (
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <Section title="Bahagian Upward Mobility">
                    <InfoCard title="Peringatan Penting" type="info">
                      <p>[SESI 2 & 4 SAHAJA] Sila lengkapkan borang Forms Upward Mobility di pautan berikut:</p>
                      <a
                        href="YOUR_UPWARD_MOBILITY_GOOGLE_FORM_LINK_HERE"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Link to Upward Mobility Google Form
                      </a>
                    </InfoCard>
                  </Section>
                </div>
              )}
            </>
          )}

          {/* Submit area: white card with centered buttons */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={loading}
              >
                Reset Form
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Laporan Maju'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LaporanMajuPage;
