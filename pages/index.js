import React from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

// A reusable component for the navigation cards on the portal
const ToolCard = ({ href, title, description }) => (
  <Link href={href} className="block p-6 bg-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-transform duration-200">
    <h3 className="text-xl font-bold text-blue-600 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </Link>
);

export default function HomePage() {
  const { data: session, status } = useSession();

  // Display a loading message while the session status is being checked
  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Portal Mentor iTEKAD</h1>
          <p className="text-gray-500 mt-1">Sila pilih borang yang ingin anda isi atau kemaskini.</p>
          <div className="flex justify-center items-center mt-6 border-t pt-6">
            <img src="/logo1.png" alt="Logo" className="h-12 sm:h-16" />
          </div>
        </header>

        {/* If the user is not logged in, show the sign-in button */}
        {!session ? (
          <div className="text-center bg-white p-8 rounded-xl shadow-md">
            <p className="mb-4 text-lg">Sila log masuk untuk mengakses alatan mentor.</p>
            <button
              onClick={() => signIn('google')}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Log Masuk dengan Google
            </button>
          </div>
        ) : (
          // If the user is logged in, show the welcome message and tool cards
          <div>
            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-md">
              <p>Selamat datang, <strong>{session.user.name}</strong>!</p>
              <button
                onClick={() => signOut()}
                className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                Log Keluar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ToolCard
                href="/laporan-sesi"
                title="Laporan Sesi iTEKAD"
                description="Isi laporan berterusan untuk usahawan anda di sini."
              />
              <ToolCard
                href="/upward-mobility"
                title="Borang Upward Mobility"
                description="Lengkapkan borang Upward Mobility untuk Sesi 2 dan Sesi 4."
              />
              <ToolCard
                href="/growthwheel"
                title="Penilaian GrowthWheel 360°"
                description="Gunakan alat ini untuk menjalankan penilaian dan memuat turun carta visual."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
