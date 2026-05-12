import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import { canAccessAdmin, isReadOnly } from '../../../lib/auth';
import AccessDenied from '../../../components/AccessDenied';
import ReadOnlyBadge from '../../../components/ReadOnlyBadge';

const PROGRAM_COLORS = {
  Bangkit: 'bg-blue-100 text-blue-800',
  Maju: 'bg-purple-100 text-purple-800',
};

export default function MentorProfile({ userEmail, isReadOnlyUser, accessDenied }) {
  const router = useRouter();
  const { mentorId } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (accessDenied) return <AccessDenied userEmail={userEmail} />;

  useEffect(() => {
    if (!mentorId) return;
    fetch(`/api/admin/mentors/${mentorId}/profile`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error);
        setData(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [mentorId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/admin" className="hover:text-blue-600">Admin</Link>
          <span>›</span>
          <Link href="/admin/mentors" className="hover:text-blue-600">Direktori Mentor</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">{data?.mentor?.name || 'Profil Mentor'}</span>
        </nav>

        {loading && (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Memuatkan profil mentor...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700 mb-4">
            ❌ {error}
          </div>
        )}

        {data && (
          <>
            {/* Mentor info card */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">{data.mentor.name}</h1>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>{data.mentor.email}</div>
                    {data.mentor.phone && <div>{data.mentor.phone}</div>}
                    {data.mentor.zone && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-700">Zon:</span>
                        <span>{data.mentor.zone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isReadOnlyUser && (
                    <Link
                      href={`/admin/reassign-mentor?mentorId=${data.mentor.id}`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                    >
                      Tugaskan Semula
                    </Link>
                  )}
                  {isReadOnlyUser && <ReadOnlyBadge />}
                </div>
              </div>
            </div>

            {/* Summary badges */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-sm text-gray-500 mb-1">Jumlah Usahawan</div>
                <div className="text-3xl font-bold text-green-600">{data.summary.total_mentees}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-sm text-gray-500 mb-1">Jumlah Sesi Dihantar</div>
                <div className="text-3xl font-bold text-indigo-600">{data.summary.total_sessions}</div>
              </div>
            </div>

            {/* Per-batch sections */}
            {data.batches.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                Tiada usahawan aktif untuk mentor ini.
              </div>
            ) : (
              data.batches.map(batch => (
                <div key={batch.batch_name} className="bg-white rounded-lg shadow mb-4 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <h2 className="text-base font-semibold text-gray-800">{batch.batch_name}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROGRAM_COLORS[batch.program] || 'bg-gray-100 text-gray-700'}`}>
                      {batch.program}
                    </span>
                    <span className="text-sm text-gray-400 ml-auto">{batch.mentees.length} usahawan</span>
                  </div>
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Usahawan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Perniagaan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Zon</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Sesi Dihantar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batch.mentees.map(mentee => (
                        <tr key={mentee.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{mentee.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{mentee.business_name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{mentee.zone || '—'}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              mentee.sessions_submitted > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {mentee.sessions_submitted}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}

            <div className="mt-4">
              <Link
                href="/admin/mentors"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                ← Kembali ke Direktori Mentor
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);
  if (!hasAccess) return { props: { accessDenied: true, userEmail } };

  const isReadOnlyUser = await isReadOnly(userEmail);
  return { props: { userEmail, isReadOnlyUser } };
}
