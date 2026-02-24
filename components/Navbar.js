// components/Navbar.js
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthenticated = status === 'authenticated';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = isAuthenticated && session?.user?.email &&
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session.user.email);

  // Helper to check if a path is the current page
  const isCurrentPage = (path) => router.asPath.split('?')[0] === path;

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 md:gap-3">
              <img className="h-8 md:h-10 w-auto" src="/logo1.png" alt="Logo" />
              <span className="font-bold text-sm md:text-xl text-gray-800 hidden sm:inline">Mentor Portal</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700 hover:text-blue-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Desktop Navigation Menu */}
          <div className="hidden md:flex items-center gap-1 lg:gap-4">
            {/* Home Link - Always visible */}
            <Link
              href="/"
              className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isCurrentPage('/') ? 'text-blue-600 bg-blue-50 cursor-default' : 'text-gray-700 hover:text-blue-600'}`}
              onClick={(e) => isCurrentPage('/') && e.preventDefault()}
            >
              Home
            </Link>

            {/* Authenticated User Menu */}
            {isAuthenticated && (
              <>
                <Link
                  href="/mentor/dashboard"
                  className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isCurrentPage('/mentor/dashboard') ? 'text-blue-600 bg-blue-50 cursor-default' : 'text-gray-700 hover:text-blue-600'}`}
                  onClick={(e) => isCurrentPage('/mentor/dashboard') && e.preventDefault()}
                >
                  Dashboard
                </Link>

                <Link
                  href="/mentor/usahawan-saya"
                  className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isCurrentPage('/mentor/usahawan-saya') ? 'text-blue-600 bg-blue-50 cursor-default' : 'text-gray-700 hover:text-blue-600'}`}
                  onClick={(e) => isCurrentPage('/mentor/usahawan-saya') && e.preventDefault()}
                >
                  Usahawan Saya
                </Link>

                {/* Dropdown for Laporan options */}
                <div className="relative group pb-2">
                  <button className="text-gray-700 hover:text-blue-600 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap">
                    Laporan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 pt-2 z-50 hidden group-hover:block">
                    <Link
                      href="/laporan-bangkit"
                      className={`block px-4 py-2 text-sm ${isCurrentPage('/laporan-bangkit') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                      onClick={(e) => isCurrentPage('/laporan-bangkit') && e.preventDefault()}
                    >
                      Laporan BangKIT
                    </Link>
                    <Link
                      href="/laporan-maju-um"
                      className={`block px-4 py-2 text-sm ${isCurrentPage('/laporan-maju-um') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                      onClick={(e) => isCurrentPage('/laporan-maju-um') && e.preventDefault()}
                    >
                      Laporan MAJU/UM
                    </Link>
                  </div>
                </div>

                {/* Admin Menu (only for admin users) */}
                {isAdmin && (
                  <div className="relative group pb-2">
                    <button className="text-gray-700 hover:text-blue-600 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap">
                      Admin
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 pt-2 z-50 hidden group-hover:block">
                      <Link
                        href="/admin/dashboard"
                        className={`block px-4 py-2 text-sm ${isCurrentPage('/admin/dashboard') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                        onClick={(e) => isCurrentPage('/admin/dashboard') && e.preventDefault()}
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/admin/usahawan"
                        className={`block px-4 py-2 text-sm ${isCurrentPage('/admin/usahawan') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                        onClick={(e) => isCurrentPage('/admin/usahawan') && e.preventDefault()}
                      >
                        Direktori Usahawan
                      </Link>
                      <Link
                        href="/admin/lawatan-premis"
                        className={`block px-4 py-2 text-sm ${isCurrentPage('/admin/lawatan-premis') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                        onClick={(e) => isCurrentPage('/admin/lawatan-premis') && e.preventDefault()}
                      >
                        Lawatan Premis
                      </Link>
                      <Link
                        href="/admin/verification"
                        className={`block px-4 py-2 text-sm ${isCurrentPage('/admin/verification') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                        onClick={(e) => isCurrentPage('/admin/verification') && e.preventDefault()}
                      >
                        Verification
                      </Link>
                      <Link
                        href="/admin/mia"
                        className={`block px-4 py-2 text-sm ${isCurrentPage('/admin/mia') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:bg-blue-50'}`}
                        onClick={(e) => isCurrentPage('/admin/mia') && e.preventDefault()}
                      >
                        MIA
                      </Link>
                    </div>
                  </div>
                )}

                {/* User Info and Logout */}
                <div className="flex items-center gap-2 border-l border-gray-300 pl-2 lg:pl-4">
                  <div className="text-sm text-gray-600 hidden lg:block truncate max-w-[150px]">
                    {session.user?.name || session.user?.email}
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
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
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
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

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              href="/"
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${isCurrentPage('/') ? 'text-blue-600 bg-blue-50 cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
              onClick={(e) => {
                if (isCurrentPage('/')) {
                  e.preventDefault();
                } else {
                  setMobileMenuOpen(false);
                }
              }}
            >
              Home
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  href="/mentor/dashboard"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${isCurrentPage('/mentor/dashboard') ? 'text-blue-600 bg-blue-50 cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                  onClick={(e) => {
                    if (isCurrentPage('/mentor/dashboard')) {
                      e.preventDefault();
                    } else {
                      setMobileMenuOpen(false);
                    }
                  }}
                >
                  Dashboard
                </Link>

                <Link
                  href="/mentor/usahawan-saya"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${isCurrentPage('/mentor/usahawan-saya') ? 'text-blue-600 bg-blue-50 cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                  onClick={(e) => {
                    if (isCurrentPage('/mentor/usahawan-saya')) {
                      e.preventDefault();
                    } else {
                      setMobileMenuOpen(false);
                    }
                  }}
                >
                  Usahawan Saya
                </Link>

                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Laporan</p>
                  <div className="space-y-1 pl-4">
                    <Link
                      href="/laporan-bangkit"
                      className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/laporan-bangkit') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                      onClick={(e) => {
                        if (isCurrentPage('/laporan-bangkit')) {
                          e.preventDefault();
                        } else {
                          setMobileMenuOpen(false);
                        }
                      }}
                    >
                      Laporan BangKIT
                    </Link>
                    <Link
                      href="/laporan-maju-um"
                      className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/laporan-maju-um') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                      onClick={(e) => {
                        if (isCurrentPage('/laporan-maju-um')) {
                          e.preventDefault();
                        } else {
                          setMobileMenuOpen(false);
                        }
                      }}
                    >
                      Laporan MAJU/UM
                    </Link>
                  </div>
                </div>

                {/* Admin Section (mobile) */}
                {isAdmin && (
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">Admin</p>
                    <div className="space-y-1 pl-4">
                      <Link
                        href="/admin/dashboard"
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/admin/dashboard') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                        onClick={(e) => {
                          if (isCurrentPage('/admin/dashboard')) {
                            e.preventDefault();
                          } else {
                            setMobileMenuOpen(false);
                          }
                        }}
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/admin/usahawan"
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/admin/usahawan') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                        onClick={(e) => {
                          if (isCurrentPage('/admin/usahawan')) {
                            e.preventDefault();
                          } else {
                            setMobileMenuOpen(false);
                          }
                        }}
                      >
                        Direktori Usahawan
                      </Link>
                      <Link
                        href="/admin/lawatan-premis"
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/admin/lawatan-premis') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                        onClick={(e) => {
                          if (isCurrentPage('/admin/lawatan-premis')) {
                            e.preventDefault();
                          } else {
                            setMobileMenuOpen(false);
                          }
                        }}
                      >
                        Lawatan Premis
                      </Link>
                      <Link
                        href="/admin/verification"
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/admin/verification') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                        onClick={(e) => {
                          if (isCurrentPage('/admin/verification')) {
                            e.preventDefault();
                          } else {
                            setMobileMenuOpen(false);
                          }
                        }}
                      >
                        Verification
                      </Link>
                      <Link
                        href="/admin/mia"
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${isCurrentPage('/admin/mia') ? 'text-blue-600 bg-blue-50 font-medium cursor-default' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                        onClick={(e) => {
                          if (isCurrentPage('/admin/mia')) {
                            e.preventDefault();
                          } else {
                            setMobileMenuOpen(false);
                          }
                        }}
                      >
                        MIA
                      </Link>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="text-sm text-gray-600 px-3 py-2">
                    {session.user?.name || session.user?.email}
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="w-full text-left bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors mx-0"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}

            {!isAuthenticated && status !== 'loading' && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signIn('google');
                }}
                className="w-full text-left bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors mx-0"
              >
                Login
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
