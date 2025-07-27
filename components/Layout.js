// components/Layout.js
import Link from 'next/link';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow-sm">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <Link href="/" legacyBehavior>
                <a className="flex items-center gap-3">
                  <img className="h-10 w-auto" src="/logo1.png" alt="Logo" />
                  <span className="font-bold text-xl text-gray-800">Mentor Portal</span>
                </a>
              </Link>
            </div>
          </div>
        </nav>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
