import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

export default function MentorManagement({ userEmail, isReadOnlyUser, accessDenied }) {
  const router = useRouter();
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    ic_number: '',
    address: '',
    state: '',
    bank_account: '',
    emergency_contact: ''
  });

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  useEffect(() => {
    fetchMentors();
  }, []);

  const fetchMentors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mentors');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMentors(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMentor = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/mentors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      alert('✅ Mentor berjaya ditambah');
      setShowAddModal(false);
      resetForm();
      fetchMentors();
    } catch (err) {
      alert(`❌ Gagal menambah mentor: ${err.message}`);
    }
  };

  const handleEditMentor = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      alert('✅ Maklumat mentor berjaya dikemaskini');
      setShowEditModal(false);
      setSelectedMentor(null);
      resetForm();
      fetchMentors();
    } catch (err) {
      alert(`❌ Gagal mengemaskini mentor: ${err.message}`);
    }
  };

  const handleRetireMentor = async (mentor) => {
    // Check for active mentees
    if (mentor.active_mentees > 0) {
      alert(`❌ Tidak boleh menamatkan mentor dengan ${mentor.active_mentees} mentee aktif. Sila pindahkan mentee terlebih dahulu.`);
      return;
    }

    if (!confirm(`Adakah anda pasti untuk menamatkan mentor ${mentor.name}? Tindakan ini tidak boleh dibatalkan.`)) {
      return;
    }

    try {
      console.log('🔄 Retiring mentor:', mentor.id, mentor.name);
      const res = await fetch(`/api/admin/mentors/${mentor.id}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('📡 Response status:', res.status);
      const json = await res.json();
      console.log('📦 Response body:', json);
      if (!json.success) throw new Error(json.error);

      alert('✅ Mentor berjaya ditamatkan');
      fetchMentors();
    } catch (err) {
      alert(`❌ Gagal menamatkan mentor: ${err.message}`);
    }
  };

  const openEditModal = (mentor) => {
    setSelectedMentor(mentor);
    setFormData({
      name: mentor.name || '',
      email: mentor.email || '',
      phone: mentor.phone || '',
      ic_number: mentor.ic_number || '',
      address: mentor.address || '',
      state: mentor.state || '',
      bank_account: mentor.bank_account || '',
      emergency_contact: mentor.emergency_contact || ''
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      ic_number: '',
      address: '',
      state: '',
      bank_account: '',
      emergency_contact: ''
    });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Filter mentors
  const filteredMentors = mentors.filter(mentor => {
    const matchesSearch =
      mentor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.phone?.includes(searchQuery);

    const matchesStatus = filterStatus === 'all' || mentor.status === filterStatus;
    const matchesProgram = filterProgram === 'all' ||
      (mentor.programs_served && mentor.programs_served.includes(filterProgram));

    return matchesSearch && matchesStatus && matchesProgram;
  });

  // Stats
  const stats = {
    total: mentors.length,
    active: mentors.filter(m => m.status === 'active').length,
    inactive: mentors.filter(m => m.status === 'inactive').length,
    totalMentees: mentors.reduce((sum, m) => sum + (m.active_mentees || 0), 0)
  };

  const programs = ['Bangkit', 'Maju', 'TUBF'];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Pengurusan Mentor</h1>
            <p className="text-gray-600 mt-1">Tambah, edit, atau tamatkan mentor</p>
          </div>
          {isReadOnlyUser && <ReadOnlyBadge />}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Jumlah Mentor</div>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Mentor Aktif</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Mentor Tamat</div>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Jumlah Mentee Aktif</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.totalMentees}</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Cari nama, email, atau telefon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tamat</option>
            </select>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">Semua Program</option>
              {programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {!isReadOnlyUser && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              + Tambah Mentor Baru
            </button>
          )}
        </div>

        {/* Mentor Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <div className="text-gray-600">Memuatkan data mentor...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <div className="text-red-600">❌ {error}</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Telefon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Zon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mentee Aktif</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tindakan</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMentors.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      Tiada mentor dijumpai
                    </td>
                  </tr>
                ) : (
                  filteredMentors.map((mentor) => (
                    <tr key={mentor.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{mentor.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{mentor.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{mentor.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{mentor.programs_served || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{mentor.zones_covered || '—'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          mentor.active_mentees > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {mentor.active_mentees || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          mentor.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {mentor.status === 'active' ? 'Aktif' : 'Tamat'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!isReadOnlyUser && (
                          <div className="flex gap-2">
                            {mentor.status === 'active' && (
                              <>
                                <button
                                  onClick={() => openEditModal(mentor)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => router.push(`/admin/reassign-mentor?mentorId=${mentor.id}`)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Tugaskan Semula
                                </button>
                                <button
                                  onClick={() => handleRetireMentor(mentor)}
                                  className="text-red-600 hover:text-red-800 font-medium"
                                >
                                  Tamatkan Penugasan
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Mentor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Tambah Mentor Baru</h2>
              <form onSubmit={handleAddMentor}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. IC</label>
                    <input
                      type="text"
                      name="ic_number"
                      value={formData.ic_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Negeri</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Akaun Bank</label>
                    <input
                      type="text"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kenalan Kecemasan</label>
                    <input
                      type="text"
                      name="emergency_contact"
                      value={formData.emergency_contact}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    Tambah Mentor
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mentor Modal */}
      {showEditModal && selectedMentor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Edit Mentor: {selectedMentor.name}</h2>
              <form onSubmit={handleEditMentor}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. IC</label>
                    <input
                      type="text"
                      name="ic_number"
                      value={formData.ic_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Negeri</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Akaun Bank</label>
                    <input
                      type="text"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kenalan Kecemasan</label>
                    <input
                      type="text"
                      name="emergency_contact"
                      value={formData.emergency_contact}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setSelectedMentor(null); resetForm(); }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
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
