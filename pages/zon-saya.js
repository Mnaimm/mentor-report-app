import React, { useState, useEffect } from 'react';
import { getSession } from 'next-auth/react';
import { canAccessAdmin } from '../lib/auth';

export default function PerbandinganZon() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/admin/zone-comparison')
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error);
        setData(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Memuatkan data zon...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700">
            ❌ {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Perbandingan Zon</h1>
          <p className="text-gray-500 mt-1">Prestasi keseluruhan mengikut zon</p>
        </div>

        {/* Grand-total summary badges */}
        {data?.summary && (
          <div className="grid grid-cols-3 gap-4 mb-8">
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
        )}

        {/* Zone cards grid */}
        {!data?.zones?.length ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Tiada data zon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.zones.map(zone => (
              <div key={zone.zone} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-base font-semibold text-gray-800">Zon {zone.zone}</h2>
                  <div className="flex gap-4 mt-1 text-sm text-gray-500">
                    <span>{zone.total_mentors} mentor</span>
                    <span>·</span>
                    <span>{zone.total_mentees} usahawan</span>
                    <span>·</span>
                    <span>{zone.total_sessions} sesi</span>
                  </div>
                </div>
                {zone.by_program.length > 0 && (
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-white">
                        <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Program</th>
                        <th className="px-5 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Usahawan</th>
                        <th className="px-5 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Sesi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {zone.by_program.map(row => (
                        <tr key={row.program} className="hover:bg-gray-50">
                          <td className="px-5 py-2 text-sm font-medium text-gray-800">{row.program}</td>
                          <td className="px-5 py-2 text-sm text-center text-gray-700">{row.mentees}</td>
                          <td className="px-5 py-2 text-sm text-center text-gray-700">{row.sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return { redirect: { destination: '/', permanent: false } };

  return { props: {} };
}
