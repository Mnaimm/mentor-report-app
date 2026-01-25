// components/MenteeCard.js
import React from 'react';
import { useRouter } from 'next/router';

export default function MenteeCard({ mentee, selected, onSelect, onAssign, onViewDetails, isReadOnly, onSubmitReport, onContact }) {
  const router = useRouter();

  // Status priority for card display
  const getCardPriority = (mentee) => {
    if (mentee.status === 'overdue') return 1;
    if (mentee.status === 'due_soon') return 2;
    if (mentee.status === 'on_track') return 3;
    if (mentee.status === 'pending_first_session') return 4;
    return 5;
  };

  // Status colors and border styles
  const getStatusStyles = (mentee) => {
    if (mentee.status === 'overdue') {
      return {
        border: 'border-l-4 border-red-500',
        badge: 'bg-red-100 text-red-800',
        badgeText: '🔴 OVERDUE'
      };
    }

    if (mentee.status === 'due_soon') {
      return {
        border: 'border-l-4 border-yellow-500',
        badge: 'bg-yellow-100 text-yellow-800',
        badgeText: '🟡 DUE SOON'
      };
    }

    if (mentee.status === 'on_track') {
      return {
        border: 'border-l-4 border-green-500',
        badge: 'bg-green-100 text-green-800',
        badgeText: '🟢 ON TRACK'
      };
    }

    if (mentee.status === 'mia') {
      return {
        border: 'border-l-4 border-red-500',
        badge: 'bg-red-100 text-red-800',
        badgeText: '🔴 MIA'
      };
    }

    return {
      border: 'border-l-4 border-gray-400',
      badge: 'bg-gray-100 text-gray-600',
      badgeText: '⚪ NOT STARTED'
    };
  };

  const styles = getStatusStyles(mentee);

  // Extract program from batch name
  const getProgram = (batch) => {
    if (!batch) return 'Unknown';
    const batchLower = batch.toLowerCase();
    if (batchLower.includes('bangkit')) return 'Bangkit';
    if (batchLower.includes('maju')) return 'Maju';
    if (batchLower.includes('tubf')) return 'TUBF';
    return 'Other';
  };

  const getProgramColor = (program) => {
    const colors = {
      'Bangkit': 'bg-blue-100 text-blue-800',
      'Maju': 'bg-green-100 text-green-800',
      'TUBF': 'bg-purple-100 text-purple-800',
      'Other': 'bg-gray-100 text-gray-800'
    };
    return colors[program] || colors['Other'];
  };

  const program = getProgram(mentee.batch);

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(mentee);
    } else {
      alert(`Mentee Details:\n\nName: ${mentee.name}\nBusiness: ${mentee.businessName || 'N/A'}\nBatch: ${mentee.batch}\nRegion: ${mentee.region}\nMentor: ${mentee.mentorName || 'Not assigned'}\nEmail: ${mentee.email}\nPhone: ${mentee.phone || 'N/A'}\nStatus: ${mentee.status}\nSessions: ${mentee.sessionsCompleted || 0}/${mentee.totalSessions || 0}\nProgress: ${mentee.progressPercentage || 0}%\nLast Report: ${mentee.daysSinceLastReport ? mentee.daysSinceLastReport + ' days ago' : 'N/A'}`);
    }
  };

  const handleSubmitReport = () => {
    if (onSubmitReport) {
      onSubmitReport(mentee);
    }
  };

  const handleContact = (method) => {
    if (onContact) {
      onContact(mentee, method);
    } else if (method === 'email') {
      window.location.href = `mailto:${mentee.email}`;
    } else if (method === 'phone' && mentee.phone) {
      window.location.href = `tel:${mentee.phone}`;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-xl transition-all duration-200 p-4 ${styles.border} ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Checkbox in top-right corner - only show if not read-only and onSelect is provided */}
      {!isReadOnly && onSelect && (
        <div className="absolute top-3 right-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Status Badge */}
      <div className="mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles.badge}`}>
          {styles.badgeText}
        </span>
      </div>

      {/* Mentee Info */}
      <div className="mb-3 pr-6">
        <h4 className="font-bold text-lg text-gray-900 mb-1">{mentee.name}</h4>
        {mentee.businessName && (
          <p className="text-sm text-gray-600 mb-2">{mentee.businessName}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          {mentee.batch && (
            <>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getProgramColor(program)}`}>
                {program}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                {mentee.batch}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Current Round Progress */}
      {mentee.currentRound && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs font-semibold text-blue-700 mb-1">
            {mentee.batchPeriod || mentee.currentRound}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700">This Round:</span>
            <span className="text-lg font-bold text-blue-600">
              {mentee.reportsThisRound || 0}/{mentee.expectedReportsThisRound || 1}
            </span>
          </div>
          {mentee.roundDueDate && (
            <div className="text-xs text-gray-600 mt-1">
              {mentee.daysUntilDue < 0 ? (
                <span className="text-red-600 font-semibold">
                  Overdue by {Math.abs(mentee.daysUntilDue)} days
                </span>
              ) : mentee.status === 'on_track' ? (
                <span className="text-green-600 font-semibold">✓ Completed</span>
              ) : (
                <span>Due: {new Date(mentee.roundDueDate).toLocaleDateString()} ({mentee.daysUntilDue}d)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Session Details */}
      <div className="space-y-2 text-sm mb-4">
        {mentee.totalSessions !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">All Sessions:</span>
            <span className="font-medium">{mentee.completedSessions || 0}/{mentee.totalSessions || 0}</span>
          </div>
        )}
        {mentee.lastSessionDate && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last Session:</span>
            <span className="font-medium text-xs">
              {new Date(mentee.lastSessionDate).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Primary Action - Context Aware */}
        {(mentee.status === 'overdue' || mentee.status === 'due_soon' || mentee.status === 'pending_first_session') && !isReadOnly && (
          <button
            onClick={handleSubmitReport}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            📝 Submit Session Report
          </button>
        )}

        {/* Secondary Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleViewDetails}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg text-xs transition-colors"
          >
            View Details
          </button>
          <button
            onClick={() => handleContact('email')}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-3 rounded-lg text-xs transition-colors"
          >
            📧 Email
          </button>
        </div>
      </div>
    </div>
  );
}
