import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

export default function ReassignMentor({ userEmail, isReadOnlyUser, accessDenied }) {
  const router = useRouter();
  const { mentorId } = router.query;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: Select source mentor
  const [mentors, setMentors] = useState([]);
  const [sourceMentor, setSourceMentor] = useState(null);
  const [searchMentor, setSearchMentor] = useState('');

  // Step 2: Assign new mentor per mentee
  const [mentees, setMentees] = useState([]);
  const [reassignments, setReassignments] = useState({});
  const [folderIds, setFolderIds] = useState({});
  const [availableMentors, setAvailableMentors] = useState([]);

  // Step 3: Confirmation
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [results, setResults] = useState({ updated: [], errors: [] });

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  // Load mentors on mount and pre-select if mentorId in URL
  useEffect(() => {
    fetchMentors();
  }, []);

  useEffect(() => {
    if (mentorId && mentors.length > 0 && !sourceMentor) {
      console.log('🔍 Auto-selecting mentor with ID:', mentorId);
      const mentor = mentors.find(m => m.id === mentorId);
      if (mentor) {
        console.log('✅ Mentor found, auto-advancing to Step 2:', mentor.name);
        setSourceMentor(mentor);
        setStep(2);
      } else {
        console.warn('⚠️ Mentor not found in list with ID:', mentorId);
      }
    }
  }, [mentorId, mentors, sourceMentor]);

  // Fetch mentees when step 2 is reached
  useEffect(() => {
    if (step === 2 && sourceMentor) {
      fetchMentees();
      fetchAvailableMentors();
    }
  }, [step, sourceMentor]);

  const fetchMentors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mentors');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch mentors');
      }

      // Filter only active mentors and sort by name
      const activeMentors = (json.data || [])
        .filter(m => m.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name));

      setMentors(activeMentors);
    } catch (err) {
      console.error('Error fetching mentors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reassign-mentor?mentorId=${sourceMentor.id}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch mentees');
      }

      const menteesData = json.data || [];
      setMentees(menteesData);

      // Initialize folder IDs
      const initialFolderIds = {};
      menteesData.forEach(m => {
        initialFolderIds[m.entrepreneurId] = m.folderId;
      });
      setFolderIds(initialFolderIds);
    } catch (err) {
      console.error('Error fetching mentees:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMentors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/available-mentors?excludeMentorId=${sourceMentor.id}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch available mentors');
      }

      console.log('✅ Available mentors for dropdown:', json.data?.length || 0, 'mentors');
      setAvailableMentors(json.data || []);
    } catch (err) {
      console.error('❌ Error fetching available mentors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMentorSelect = (menteeId, mentorId) => {
    setReassignments(prev => ({ ...prev, [menteeId]: mentorId }));
  };

  const handleFolderIdChange = (menteeId, value) => {
    setFolderIds(prev => ({ ...prev, [menteeId]: value }));
  };

  const goToStep2 = () => {
    if (!sourceMentor) {
      alert('Sila pilih mentor asal terlebih dahulu.');
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    // Check all mentees have a new mentor assigned
    const unassigned = mentees.filter(m => !reassignments[m.entrepreneurId]);
    if (unassigned.length > 0) {
      alert(`Sila tetapkan mentor baru untuk semua mentee. ${unassigned.length} mentee belum ditetapkan.`);
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Build payload
      const payload = {
        sourceMentorId: sourceMentor.id,
        reassignments: mentees.map(mentee => {
          const newMentorId = reassignments[mentee.entrepreneurId];
          const newMentor = availableMentors.find(m => m.id === newMentorId);

          return {
            assignmentId: mentee.assignmentId,
            entrepreneurId: mentee.entrepreneurId,
            batchId: mentee.batchId,
            newMentorId: newMentorId,
            newMentorName: newMentor.name,
            newMentorEmail: newMentor.email,
            menteeName: mentee.name,
            menteeEmail: mentee.email,
            folderId: folderIds[mentee.entrepreneurId] || null
          };
        })
      };

      const res = await fetch('/api/admin/reassign-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Gagal menugaskan semula mentee');
      }

      setResults(json);
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSourceMentor(null);
    setMentees([]);
    setReassignments({});
    setFolderIds({});
    setAvailableMentors([]);
    setSubmitSuccess(false);
    setResults({ updated: [], errors: [] });
    router.push('/admin/reassign-mentor', undefined, { shallow: true });
  };

  const filteredMentors = mentors.filter(m =>
    m.name.toLowerCase().includes(searchMentor.toLowerCase()) ||
    m.email.toLowerCase().includes(searchMentor.toLowerCase())
  );

  const assignedCount = mentees.filter(m => reassignments[m.entrepreneurId]).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Tugaskan Semula Mentee</h1>
            <p className="text-gray-600 mt-1">Pindahkan mentee dari satu mentor ke mentor lain</p>
          </div>
          {isReadOnlyUser && <ReadOnlyBadge />}
        </div>

        {/* Progress Indicator */}
        {!submitSuccess && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {[1, 2, 3].map((s, idx) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                      ${s < step ? 'bg-green-500 text-white' :
                        s === step ? 'bg-blue-600 text-white' :
                        'bg-gray-300 text-gray-600'}`}>
                      {s < step ? '✓' : s}
                    </div>
                    <div className={`text-xs mt-2 font-medium ${s === step ? 'text-blue-600' : 'text-gray-600'}`}>
                      {s === 1 && 'Pilih Mentor Asal'}
                      {s === 2 && 'Tugaskan Mentor Baru'}
                      {s === 3 && 'Sahkan & Laksana'}
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-1 mx-4 ${s < step ? 'bg-green-500' : 'bg-gray-300'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Select Source Mentor */}
        {step === 1 && !submitSuccess && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 1: Pilih Mentor Asal</h2>
            <p className="text-gray-600 mb-4">Pilih mentor yang mentee-nya ingin dipindahkan.</p>

            <input
              type="text"
              placeholder="Cari nama atau email mentor..."
              value={searchMentor}
              onChange={(e) => setSearchMentor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            />

            {loading ? (
              <div className="text-center py-8 text-gray-600">Memuatkan data mentor...</div>
            ) : filteredMentors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {mentors.length === 0
                  ? 'Tiada mentor aktif dijumpai.'
                  : 'Tiada mentor sepadan dengan carian.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMentors.map(mentor => (
                  <div
                    key={mentor.id}
                    onClick={() => setSourceMentor(mentor)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${sourceMentor?.id === mentor.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                  >
                    <div className="font-semibold text-gray-800">{mentor.name}</div>
                    <div className="text-sm text-gray-600">{mentor.email}</div>
                    <div className="text-sm text-blue-600 mt-1">{mentor.active_mentees || 0} mentee aktif</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={goToStep2}
                disabled={!sourceMentor}
                className={`px-6 py-2 rounded-md font-medium
                  ${!sourceMentor
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Seterusnya →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Assign New Mentor per Mentee */}
        {step === 2 && !submitSuccess && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 2: Tugaskan Mentor Baru</h2>
            <p className="text-gray-600 mb-4">
              Tetapkan mentor baru untuk setiap mentee di bawah <strong>{sourceMentor.name}</strong>.
            </p>

            <div className="mb-4 text-sm text-gray-700">
              <strong>{assignedCount} / {mentees.length}</strong> mentee telah ditetapkan mentor baru
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-600">Memuatkan data mentee...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Mentee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zon</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Folder ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentor Baru</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mentees.map(mentee => {
                      const selectedMentorId = reassignments[mentee.entrepreneurId];
                      const selectedMentor = availableMentors.find(m => m.id === selectedMentorId);

                      return (
                        <tr key={mentee.entrepreneurId}>
                          <td className="px-4 py-3 text-sm text-gray-800">{mentee.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{mentee.program}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{mentee.batch}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{mentee.zone}</td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={folderIds[mentee.entrepreneurId] || ''}
                              onChange={(e) => handleFolderIdChange(mentee.entrepreneurId, e.target.value)}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Folder ID"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={selectedMentorId || ''}
                              onChange={(e) => handleMentorSelect(mentee.entrepreneurId, e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[200px]"
                            >
                              <option value="">-- Pilih Mentor --</option>
                              {availableMentors.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.active_mentees} mentee)
                                </option>
                              ))}
                            </select>
                            {selectedMentor && selectedMentor.active_mentees >= 8 && (
                              <span className="ml-2 text-amber-600" title="Mentor mencapai kapasiti">⚠️</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-400"
              >
                ← Kembali
              </button>
              <button
                onClick={goToStep3}
                disabled={assignedCount !== mentees.length}
                className={`px-6 py-2 rounded-md font-medium
                  ${assignedCount !== mentees.length
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Seterusnya →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && !submitSuccess && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 3: Sahkan & Laksana</h2>
            <p className="text-gray-600 mb-4">Semak penugasan semula sebelum mengesahkan.</p>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentor Lama</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentor Baru</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Folder ID</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mentees.map(mentee => {
                    const newMentor = availableMentors.find(m => m.id === reassignments[mentee.entrepreneurId]);
                    return (
                      <tr key={mentee.entrepreneurId}>
                        <td className="px-4 py-3 text-sm text-gray-800">{mentee.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{mentee.program}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{sourceMentor.name}</td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-medium">{newMentor?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{folderIds[mentee.entrepreneurId] || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4">
                {submitError}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                disabled={submitting}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-400 disabled:opacity-50"
              >
                ← Kembali
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || isReadOnlyUser}
                className={`px-6 py-2 rounded-md font-medium
                  ${submitting || isReadOnlyUser
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                {submitting ? 'Sedang Memproses...' : 'Sahkan Penugasan Semula'}
              </button>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {submitSuccess && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-green-600 mb-4">✓ Penugasan Semula Berjaya</h2>

            {results.updated.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Berjaya dipindahkan:</h3>
                <div className="space-y-1">
                  {results.updated.map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-700">
                      ✓ {item.menteeName} → {item.toMentor}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-red-600 mb-2">Gagal dipindahkan:</h3>
                <div className="space-y-1">
                  {results.errors.map((item, idx) => (
                    <div key={idx} className="text-sm text-red-700">
                      ✗ {item.menteeName}: {item.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={resetWizard}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
            >
              Tugaskan Semula Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } };
  }

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);
  if (!hasAccess) {
    return { props: { accessDenied: true, userEmail } };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);
  return { props: { userEmail, isReadOnlyUser } };
}
