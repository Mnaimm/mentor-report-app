import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSession } from 'next-auth/react';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

const PROGRAM_COLORS = {
  Bangkit: 'bg-blue-100 text-blue-800',
  Maju: 'bg-purple-100 text-purple-800',
};

export default function DirektoriMentor({ userEmail, isReadOnlyUser, accessDenied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [programFilter, setProgramFilter] = useState('Semua');

  if (accessDenied) return <AccessDenied userEmail={userEmail} />;

  useEffect(() => {
    fetch('/api/admin/mentors/directory')
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error);
        setData(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredZones = data
    ? data.zones
        .map(zone => ({
          ...zone,
          mentors:
            programFilter === 'Semua'
              ? zone.mentors
              : zone.mentors.filter(m => m.programs.includes(programFilter)),
        }))
        .filter(zone => zone.mentors.length > 0)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Direktori Mentor</h1>
            <p className="text-gray-600 mt-1">Senarai semua mentor aktif mengikut zon</p>
          </div>
          {isReadOnlyUser && <ReadOnlyBadge />}
        </div>

        {loading && (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Memuatkan direktori mentor...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700">
            ❌ {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary badges */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-sm text-gray-500 mb-1">Jumlah Mentor</div>
                <div className="text-3xl font-bold text-blue-600">{data.summary.total_mentors}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-sm text-gray-500 mb-1">Jumlah Usahawan</div>
                <div className="text-3xl font-bold text-green-600">{data.summary.total_mentees}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-sm text-gray-500 mb-1">Jumlah Sesi</div>
                <div className="text-3xl font-bold text-indigo-600">{data.summary.total_sessions}</div>
              </div>
            </div>

            {/* Program filter tabs */}
            <div className="flex gap-2 mb-6">
              {['Semua', 'Bangkit', 'Maju'].map(p => (
                <button
                  key={p}
                  onClick={() => setProgramFilter(p)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    programFilter === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Zone sections */}
            {filteredZones.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                Tiada mentor dijumpai untuk program ini.
              </div>
            ) : (
              filteredZones.map(zone => (
                <div key={zone.zone} className="mb-8">
                  <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="inline-block w-2 h-6 bg-blue-500 rounded-full"></span>
                    Zon {zone.zone}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      ({zone.mentors.length} mentor)
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {zone.mentors.map(mentor => (
                      <div
                        key={mentor.id}
                        className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <Link
                            href={`/admin/mentors/${mentor.id}`}
                            className="text-base font-semibold text-blue-700 hover:text-blue-900 hover:underline leading-tight"
                          >
                            {mentor.name}
                          </Link>
                        </div>
                        <div className="text-sm text-gray-500 mb-1 truncate">{mentor.email}</div>
                        <div className="text-sm text-gray-500 mb-3">{mentor.phone || '—'}</div>

                        {/* Program badges */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {mentor.programs.length > 0 ? (
                            mentor.programs.map(p => (
                              <span
                                key={p}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROGRAM_COLORS[p] || 'bg-gray-100 text-gray-700'}`}
                              >
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="flex justify-between text-sm">
                          <div className="text-center">
                            <div className="font-bold text-gray-800">{mentor.total_mentees}</div>
                            <div className="text-xs text-gray-400">Usahawan</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-gray-800">{mentor.total_sessions}</div>
                            <div className="text-xs text-gray-400">Sesi</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
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
