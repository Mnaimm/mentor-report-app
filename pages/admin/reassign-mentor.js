import React, { useState, useEffect } from 'react';
import { getSession } from 'next-auth/react';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ReassignMentor({ userEmail, isReadOnlyUser, accessDenied }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Step 1: Select mentees
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignments, setSelectedAssignments] = useState([]);
  const [searchMentor, setSearchMentor] = useState('');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');

  // Step 2: Select new mentor
  const [mentors, setMentors] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [searchNewMentor, setSearchNewMentor] = useState('');

  // Step 3: Folder IDs
  const [folderIds, setFolderIds] = useState({});

  // Step 4: Confirmation
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [updatedMentees, setUpdatedMentees] = useState([]);

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  useEffect(() => {
    if (step === 1) {
      fetchAssignments();
    } else if (step === 2) {
      fetchMentors();
    }
  }, [step]);

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('mentor_assignments')
        .select(`
          id,
          batch_id,
          entrepreneur_id,
          mentor_id,
          entrepreneurs (
            id,
            name,
            email,
            folder_id,
            program,
            batch,
            region
          ),
          mentors (
            id,
            name,
            email
          ),
          batches (
            batch_name
          )
        `)
        .eq('status', 'active')
        .eq('is_active', true)
        .order('mentors(name)');

      if (fetchError) throw fetchError;

      const formatted = data.map(a => ({
        assignmentId: a.id,
        batchId: a.batch_id,
        entrepreneurId: a.entrepreneur_id,
        menteeEmail: a.entrepreneurs?.email,
        menteeName: a.entrepreneurs?.name || 'Unknown',
        program: a.entrepreneurs?.program || '',
        batch: a.batches?.batch_name || a.entrepreneurs?.batch || '',
        region: a.entrepreneurs?.region || '',
        folderId: a.entrepreneurs?.folder_id || '',
        mentorId: a.mentor_id,
        mentorName: a.mentors?.name || 'Unknown',
        mentorEmail: a.mentors?.email || ''
      }));

      setAssignments(formatted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentors = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.rpc('get_mentors_with_counts');

      if (fetchError) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('mentors')
          .select(`
            id,
            name,
            email,
            program,
            region,
            users!inner(id)
          `)
          .eq('status', 'active');

        if (fallbackError) throw fallbackError;

        const formatted = await Promise.all(
          fallbackData.map(async (m) => {
            const { data: profile } = await supabase
              .from('mentor_profiles')
              .select('max_mentees')
              .eq('user_id', m.users.id)
              .single();

            const { count } = await supabase
              .from('mentor_assignments')
              .select('*', { count: 'exact', head: true })
              .eq('mentor_id', m.id)
              .eq('status', 'active')
              .eq('is_active', true);

            return {
              mentorId: m.id,
              userId: m.users.id,
              name: m.name,
              email: m.email,
              program: m.program,
              region: m.region,
              maxMentees: profile?.max_mentees,
              activeCount: count || 0
            };
          })
        );

        setMentors(formatted);
      } else {
        setMentors(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAssignment = (assignment) => {
    setSelectedAssignments(prev => {
      const exists = prev.find(a => a.assignmentId === assignment.assignmentId);
      if (exists) {
        return prev.filter(a => a.assignmentId !== assignment.assignmentId);
      } else {
        return [...prev, assignment];
      }
    });
  };

  const handleSelectAll = (filtered) => {
    if (selectedAssignments.length === filtered.length) {
      setSelectedAssignments([]);
    } else {
      setSelectedAssignments(filtered);
    }
  };

  const goToStep2 = () => {
    if (selectedAssignments.length === 0) return;
    const initialFolders = {};
    selectedAssignments.forEach(a => {
      initialFolders[a.assignmentId] = a.folderId || '';
    });
    setFolderIds(initialFolders);
    setStep(2);
  };

  const goToStep3 = () => {
    if (!selectedMentor) return;
    setStep(3);
  };

  const goToStep4 = () => {
    setStep(4);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const reassignments = selectedAssignments.map(a => ({
        assignmentId: a.assignmentId,
        entrepreneurId: a.entrepreneurId,
        batchId: a.batchId,
        folderId: folderIds[a.assignmentId] || null,
        menteeEmail: a.menteeEmail,
        menteeName: a.menteeName
      }));

      const res = await fetch('/api/admin/reassign-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newMentorId: selectedMentor.mentorId,
          newMentorUserId: selectedMentor.userId,
          newMentorName: selectedMentor.name,
          newMentorEmail: selectedMentor.email,
          reassignments
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setUpdatedMentees(json.updated || []);
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedAssignments([]);
    setSelectedMentor(null);
    setFolderIds({});
    setSubmitSuccess(false);
    setSubmitError(null);
    setUpdatedMentees([]);
    fetchAssignments();
  };

  // Filter assignments
  const filteredAssignments = assignments.filter(a => {
    const matchesMentor = a.mentorName.toLowerCase().includes(searchMentor.toLowerCase());
    const matchesProgram = filterProgram === 'all' || a.program === filterProgram;
    const matchesBatch = filterBatch === 'all' || a.batch === filterBatch;
    return matchesMentor && matchesProgram && matchesBatch;
  });

  // Get unique batches for filter
  const uniqueBatches = [...new Set(assignments.map(a => a.batch).filter(Boolean))];

  // Filter mentors
  const currentMentorIds = selectedAssignments.map(a => a.mentorId);
  const filteredMentors = mentors.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchNewMentor.toLowerCase());
    const notCurrentMentor = !currentMentorIds.includes(m.mentorId);
    return matchesSearch && notCurrentMentor;
  });

  const isOverCapacity = selectedMentor && selectedMentor.maxMentees &&
    selectedMentor.activeCount >= selectedMentor.maxMentees;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {isReadOnlyUser && <ReadOnlyBadge />}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Tukar Mentor</h1>
          <p className="text-gray-600 mt-1">Pindahkan mentee dari seorang mentor ke mentor lain</p>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s, idx) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    s < step ? 'bg-green-500 text-white' :
                    s === step ? 'bg-blue-600 text-white' :
                    'bg-gray-300 text-gray-600'
                  }`}>
                    {s < step ? '✓' : s}
                  </div>
                  <div className={`text-xs mt-2 font-medium ${s === step ? 'text-blue-600' : 'text-gray-600'}`}>
                    {s === 1 && 'Pilih Mentee'}
                    {s === 2 && 'Pilih Mentor Baru'}
                    {s === 3 && 'Semak Folder ID'}
                    {s === 4 && 'Sahkan'}
                  </div>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-1 mx-4 ${s < step ? 'bg-green-500' : 'bg-gray-300'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step 1: Select Mentees */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 1: Pilih Mentee untuk Dipindahkan</h2>

            {/* Filters */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Cari nama mentor..."
                value={searchMentor}
                onChange={(e) => setSearchMentor(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">Semua Program</option>
                <option value="Bangkit">Bangkit</option>
                <option value="Maju">Maju</option>
                <option value="TUBF">TUBF</option>
              </select>
              <select
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">Semua Batch</option>
                {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Selected count */}
            <div className="mb-4 text-sm font-medium text-blue-600">
              {selectedAssignments.length} mentee dipilih
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-600">Memuatkan data...</div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-lg text-red-600">❌ {error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedAssignments.length === filteredAssignments.length && filteredAssignments.length > 0}
                          onChange={() => handleSelectAll(filteredAssignments)}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nama Mentee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Program</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mentor Semasa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Zon</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAssignments.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                          Tiada tugasan aktif dijumpai
                        </td>
                      </tr>
                    ) : (
                      filteredAssignments.map(a => (
                        <tr key={a.assignmentId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={!!selectedAssignments.find(s => s.assignmentId === a.assignmentId)}
                              onChange={() => handleSelectAssignment(a)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.menteeName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.program}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.batch}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.mentorName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.region || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={goToStep2}
                disabled={selectedAssignments.length === 0}
                className={`px-6 py-2 rounded-md font-medium ${
                  selectedAssignments.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Seterusnya →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select New Mentor */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 2: Pilih Mentor Baru</h2>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Cari nama mentor..."
                value={searchNewMentor}
                onChange={(e) => setSearchNewMentor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {isOverCapacity && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
                <p className="text-amber-800 font-medium">
                  ⚠️ Amaran: Mentor ini sudah mencapai had mentee ({selectedMentor.activeCount}/{selectedMentor.maxMentees})
                </p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-gray-600">Memuatkan senarai mentor...</div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-lg text-red-600">❌ {error}</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMentors.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Tiada mentor dijumpai</div>
                ) : (
                  filteredMentors.map(m => (
                    <label
                      key={m.mentorId}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedMentor?.mentorId === m.mentorId ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newMentor"
                        checked={selectedMentor?.mentorId === m.mentorId}
                        onChange={() => setSelectedMentor(m)}
                        className="w-4 h-4 mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{m.name}</div>
                        <div className="text-sm text-gray-600">
                          {m.maxMentees ? `${m.activeCount}/${m.maxMentees}` : `${m.activeCount}`} mentee aktif
                          {' • '}{m.program} • {m.region}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                ← Kembali
              </button>
              <button
                onClick={goToStep3}
                disabled={!selectedMentor}
                className={`px-6 py-2 rounded-md font-medium ${
                  !selectedMentor
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Seterusnya →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Folder IDs */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 3: Semak Folder ID</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nama Mentee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Program</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Folder ID Semasa</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Folder ID Baru</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedAssignments.map(a => (
                    <tr key={a.assignmentId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.menteeName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.program}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.folderId || '—'}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={folderIds[a.assignmentId] || ''}
                          onChange={(e) => setFolderIds({ ...folderIds, [a.assignmentId]: e.target.value })}
                          placeholder={a.folderId ? '' : 'Tiada — tampal folder ID jika perlu'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                ← Kembali
              </button>
              <button
                onClick={goToStep4}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Seterusnya →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Langkah 4: Sahkan & Laksana</h2>

            {submitSuccess ? (
              <div className="bg-green-50 border border-green-300 rounded-lg p-6">
                <div className="text-green-800 font-bold text-lg mb-2">✅ Penugasan Semula Berjaya</div>
                <p className="text-green-700 mb-4">Mentee berikut telah dipindahkan:</p>
                <ul className="list-disc list-inside text-green-700 mb-4">
                  {updatedMentees.map((name, idx) => <li key={idx}>{name}</li>)}
                </ul>
                <button
                  onClick={resetWizard}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Mulakan Semula
                </button>
              </div>
            ) : (
              <>
                {submitError && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                    <p className="text-red-700 font-medium">❌ {submitError}</p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-semibold text-gray-700 mb-2">Ringkasan Penugasan Semula:</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mentee</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mentor Lama</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mentor Baru</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Folder ID</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedAssignments.map(a => (
                          <tr key={a.assignmentId}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.menteeName}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{a.mentorName}</td>
                            <td className="px-4 py-3 text-sm text-blue-600 font-medium">{selectedMentor.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{folderIds[a.assignmentId] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(3)}
                    disabled={submitting}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    ← Kembali
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || isReadOnlyUser}
                    className={`px-6 py-2 rounded-md font-medium ${
                      submitting || isReadOnlyUser
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {submitting ? 'Memproses...' : 'Sahkan Penugasan Semula'}
                  </button>
                </div>
              </>
            )}
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
