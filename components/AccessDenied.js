// components/AccessDenied.js
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';

export default function AccessDenied({ userEmail = null }) {
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <svg
            className="h-10 w-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Access Denied
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>

        {/* User Email Display */}
        {userEmail && (
          <div className="mb-6 p-3 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Signed in as:</p>
            <p className="text-sm font-medium text-gray-900">{userEmail}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleGoBack}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Go Back
          </button>
          <button
            onClick={handleSignOut}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Sign Out
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-6">
          If you need access to this page, please contact your program administrator.
        </p>
      </div>
    </div>
  );
}
