// components/MenteeCard.js
import React from 'react';

export default function MenteeCard({ mentee, selected, onSelect, onAssign, onViewDetails, isReadOnly, onSubmitReport, onContact }) {
  const statusColors = {
    'Active': 'bg-green-100 text-green-800',
    'on_track': 'bg-green-100 text-green-800',
    'due_soon': 'bg-yellow-100 text-yellow-800',
    'overdue': 'bg-red-100 text-red-800',
    'MIA': 'bg-red-100 text-red-800',
    'mia': 'bg-red-100 text-red-800',
    'pending_first_session': 'bg-blue-100 text-blue-800',
    'Completed': 'bg-blue-100 text-blue-800',
    'Dropped': 'bg-gray-100 text-gray-800'
  };

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

  return (
    <div className={`bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow relative ${selected ? 'ring-2 ring-blue-500' : ''}`}>
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

      <div className="mb-3 pr-6">
        <h4 className="font-semibold text-gray-900">{mentee.name}</h4>
        {mentee.businessName && (
          <p className="text-sm text-gray-600">{mentee.businessName}</p>
        )}
        <div className="flex gap-2 mt-2">
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

      <div className="space-y-2 text-sm mb-3">
        {mentee.mentorName !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">Mentor:</span>
            <span className="font-medium">{mentee.mentorName || 'Not assigned'}</span>
          </div>
        )}
        {(mentee.sessionsCompleted !== undefined || mentee.totalSessions !== undefined) && (
          <div className="flex justify-between">
            <span className="text-gray-600">Sessions:</span>
            <span className="font-medium">{mentee.sessionsCompleted || 0}/{mentee.totalSessions || 0}</span>
          </div>
        )}
        {mentee.daysSinceLastReport !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last Report:</span>
            <span className="font-medium">
              {mentee.daysSinceLastReport >= 999 ? 'Never' : `${mentee.daysSinceLastReport}d ago`}
            </span>
          </div>
        )}
        {(mentee.reportsThisRound !== undefined || mentee.expectedReportsThisRound !== undefined) && (
          <div className="flex justify-between">
            <span className="text-gray-600">Progress:</span>
            <span className="font-medium">
              {mentee.reportsThisRound || 0}/{mentee.expectedReportsThisRound || 0}
            </span>
          </div>
        )}
      </div>

      {mentee.status && (
        <div className="mb-3">
          <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[mentee.status] || 'bg-gray-100 text-gray-800'}`}>
            {mentee.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleViewDetails}
          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded"
        >
          View Details
        </button>
        {onSubmitReport && !isReadOnly && (
          <button
            onClick={() => onSubmitReport(mentee)}
            className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-2 rounded"
          >
            Submit Report
          </button>
        )}
        {onAssign && !isReadOnly && (
          <button
            onClick={onAssign}
            className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-2 rounded"
          >
            {mentee.mentorId ? 'Reassign' : 'Assign'}
          </button>
        )}
      </div>
    </div>
  );
}
