// components/StatCard.js
import React from 'react';

export default function StatCard({
  label,
  value,
  sublabel = null,
  subtitle = null,
  color = "blue",
  icon = null,
  title = null,
  change = null,
  changeType = null
}) {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50 border-blue-200",
    green: "text-green-600 bg-green-50 border-green-200",
    orange: "text-orange-600 bg-orange-50 border-orange-200",
    yellow: "text-yellow-600 bg-yellow-50 border-yellow-200",
    red: "text-red-600 bg-red-50 border-red-200",
    purple: "text-purple-600 bg-purple-50 border-purple-200",
    gray: "text-gray-600 bg-gray-50 border-gray-200"
  };

  // Use title if provided, otherwise use label
  const displayLabel = title || label;

  return (
    <div className={`rounded-xl shadow-md p-6 border-2 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-600">{displayLabel}</div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
      <div className={`text-3xl font-extrabold ${(colorClasses[color] || colorClasses.blue).split(' ')[0]}`}>
        {value}
      </div>
      {(sublabel || subtitle) && (
        <div className="text-xs text-gray-500 mt-1">{sublabel || subtitle}</div>
      )}
      {change && (
        <div className={`text-xs mt-1 ${
          changeType === 'increase' ? 'text-green-600' :
          changeType === 'decrease' ? 'text-red-600' :
          'text-gray-600'
        }`}>
          {change}
        </div>
      )}
    </div>
  );
}
