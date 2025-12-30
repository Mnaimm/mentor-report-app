// components/ReadOnlyBadge.js
import { useState } from 'react';

export default function ReadOnlyBadge({ position = 'top-right', userEmail = null }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2'
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Badge */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 px-4 py-2 rounded-lg shadow-lg border-2 border-yellow-600 cursor-help">
          {/* Eye Icon */}
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>

          <span className="font-bold text-sm">View Only</span>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute top-full mt-2 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 z-50">
            <div className="flex items-start gap-2">
              <svg
                className="h-4 w-4 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold mb-1">Read-Only Access</p>
                <p className="text-gray-300 leading-relaxed">
                  You have view-only permissions for this page. You cannot create, edit, or delete any data.
                </p>
                {userEmail && (
                  <p className="text-gray-400 mt-2 text-xs">
                    Account: {userEmail}
                  </p>
                )}
                <p className="text-gray-400 mt-2">
                  Contact your administrator to request edit access.
                </p>
              </div>
            </div>
            {/* Tooltip Arrow */}
            <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        )}
      </div>
    </div>
  );
}
