import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import BatchTimeline from '../../components/BatchTimeline';

export default function MentorTimeline() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    fetch('/api/batch-timeline')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setRounds(data.rounds || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Memuatkan jadual batch…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <Head>
        <title>Jadual Batch Saya — iTEKAD Mentor Portal</title>
      </Head>

      <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Jadual Batch Saya</h1>
            <p className="text-gray-400 text-sm">Garis masa pusingan batch yang anda kendalikan</p>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white font-medium transition-colors"
          >
            ← Kembali
          </Link>
        </div>

        {/* Content */}
        {error ? (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-6">
            <p className="text-red-300 text-sm">Ralat: {error}</p>
          </div>
        ) : (
          <BatchTimeline rounds={rounds} />
        )}
      </div>
    </>
  );
}
