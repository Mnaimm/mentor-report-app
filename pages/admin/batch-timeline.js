import { useState, useEffect } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import Head from 'next/head';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';
import BatchTimeline from '../../components/BatchTimeline';

export default function AdminBatchTimeline({ userEmail, isReadOnlyUser, accessDenied }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  useEffect(() => {
    fetch('/api/batch-timeline')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setRounds(data.rounds || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>Jadual Batch — Admin iTEKAD</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Jadual Batch</h1>
            <p className="text-gray-500 text-sm">Garis masa pusingan semua batch aktif</p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            ← Kembali ke Admin
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Memuatkan jadual batch…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-700 text-sm">Ralat: {error}</p>
          </div>
        ) : (
          <BatchTimeline rounds={rounds} />
        )}
      </div>
    </>
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
    return { redirect: { destination: '/', permanent: false } };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);

  return { props: { userEmail, isReadOnlyUser } };
}
