// components/StatusBadge.js
import React from 'react';

export default function StatusBadge({ status, size = 'normal' }) {
  const colors = {
    healthy: "bg-green-100 text-green-800 border-green-300",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-300",
    error: "bg-red-100 text-red-800 border-red-300",
    active: "bg-green-100 text-green-800 border-green-300",
    inactive: "bg-gray-100 text-gray-800 border-gray-300",
    pending: "bg-blue-100 text-blue-800 border-blue-300",
    completed: "bg-green-100 text-green-800 border-green-300",
    on_track: "bg-green-100 text-green-800 border-green-300",
    due_soon: "bg-yellow-100 text-yellow-800 border-yellow-300",
    overdue: "bg-red-100 text-red-800 border-red-300",
    mia: "bg-red-100 text-red-800 border-red-300"
  };

  const icons = {
    healthy: "✓",
    degraded: "⚠",
    error: "✕",
    active: "✓",
    inactive: "○",
    pending: "⏳",
    completed: "✓",
    on_track: "✓",
    due_soon: "⚠",
    overdue: "✕",
    mia: "✕"
  };

  const sizeClasses = {
    small: "px-2 py-0.5 text-xs",
    normal: "px-3 py-1 text-sm",
    large: "px-4 py-2 text-base"
  };

  const normalizedStatus = status ? status.toLowerCase() : 'unknown';

  return (
    <span className={`rounded-full font-semibold border ${sizeClasses[size]} ${colors[normalizedStatus] || colors.error}`}>
      {icons[normalizedStatus]} {status ? status.toUpperCase() : 'UNKNOWN'}
    </span>
  );
}
