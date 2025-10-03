// components/UserSwitcher.js
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ImpersonationManager } from '../lib/impersonation';

const UserSwitcher = ({ onImpersonationChange }) => {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentImpersonation, setCurrentImpersonation] = useState(null);

  // Check if current user can impersonate (only super admin)
  const canImpersonate = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL?.toLowerCase() ===
    session?.user?.email?.toLowerCase();

  useEffect(() => {
    // Load current impersonation state
    const current = ImpersonationManager.getImpersonateUser();
    setCurrentImpersonation(current);
  }, []);

  useEffect(() => {
    if (isOpen && mentors.length === 0) {
      fetchMentors();
    }
  }, [isOpen]);

  const fetchMentors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mapping?programType=bangkit');
      const data = await response.json();

      // Extract unique mentors
      const uniqueMentors = [...new Set(data.map(item => ({
        name: item.Mentor,
        email: item.Mentor_Email
      })).filter(mentor => mentor.email))]
        .sort((a, b) => a.name.localeCompare(b.name));

      setMentors(uniqueMentors);
    } catch (error) {
      console.error('Failed to fetch mentors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = (mentorEmail) => {
    ImpersonationManager.setImpersonateUser(mentorEmail);
    setCurrentImpersonation(mentorEmail);
    setIsOpen(false);

    // Notify parent component
    if (onImpersonationChange) {
      onImpersonationChange(mentorEmail);
    }

    // Refresh page to apply impersonation
    window.location.reload();
  };

  const handleClearImpersonation = () => {
    ImpersonationManager.clearImpersonation();
    setCurrentImpersonation(null);

    // Notify parent component
    if (onImpersonationChange) {
      onImpersonationChange(null);
    }

    // Refresh page to clear impersonation
    window.location.reload();
  };

  // Don't show for non-super admin
  if (!canImpersonate) {
    return null;
  }

  return (
    <div className="relative">
      {/* Impersonation Banner */}
      {currentImpersonation && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-800 font-medium">
                🎭 Viewing as: {currentImpersonation}
              </span>
            </div>
            <button
              onClick={handleClearImpersonation}
              className="text-yellow-800 hover:text-yellow-900 underline text-sm"
            >
              Exit Impersonation
            </button>
          </div>
        </div>
      )}

      {/* User Switcher Button */}
      <div className="mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors"
        >
          🎭 Switch User View
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm text-gray-800">View Dashboard As:</h3>
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading mentors...</div>
          ) : (
            <div className="py-2">
              {/* Option to view as yourself */}
              <button
                onClick={handleClearImpersonation}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
                  !currentImpersonation ? 'bg-blue-50 text-blue-700 font-medium' : ''
                }`}
              >
                👤 Yourself ({session?.user?.email})
              </button>

              <div className="border-t my-1"></div>

              {/* List of mentors */}
              {mentors.map((mentor, index) => (
                <button
                  key={index}
                  onClick={() => handleImpersonate(mentor.email)}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
                    currentImpersonation === mentor.email ? 'bg-yellow-50 text-yellow-700 font-medium' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium">{mentor.name}</div>
                    <div className="text-xs text-gray-500">{mentor.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t bg-gray-50">
            <button
              onClick={() => setIsOpen(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSwitcher;