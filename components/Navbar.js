// components/Navbar.js
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-3">
              <img className="h-10 w-auto" src="/logo1.png" alt="Logo" />
              <span className="font-bold text-xl text-gray-800">Mentor Portal</span>
            </Link>
          </div>

          {/* Navigation Menu */}
          <div className="flex items-center gap-4">
            {/* Home Link - Always visible */}
            <Link 
              href="/" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Home
            </Link>

            {/* Authenticated User Menu */}
            {isAuthenticated && (
              <>
                <Link 
                  href="/mentor/dashboard" 
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Mentor Dashboard
                </Link>
                
                {/* Dropdown for Laporan options */}
                <div className="relative group">
                  <button className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1">
                    Laporan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 hidden group-hover:block">
                    <Link 
                      href="/laporan-bangkit" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                    >
                      Laporan BangKIT
                    </Link>
                    <Link 
                      href="/laporan-maju-um" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                    >
                      Laporan MAJU/UM
                    </Link>
                    <Link 
                      href="/laporan-maju" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                    >
                      Laporan MAJU (Legacy)
                    </Link>
                    <Link 
                      href="/laporan-sesi" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                    >
                      Laporan Sesi
                    </Link>
                  </div>
                </div>

                {/* User Info and Logout */}
                <div className="flex items-center gap-3 border-l border-gray-300 pl-4">
                  <div className="text-sm text-gray-600">
                    {session.user?.name || session.user?.email}
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}

            {/* Not Authenticated - Login Button */}
            {!isAuthenticated && status !== 'loading' && (
              <button
                onClick={() => signIn('google')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </button>
            )}

            {/* Loading State */}
            {status === 'loading' && (
              <div className="text-sm text-gray-500">Loading...</div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
